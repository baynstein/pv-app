import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import SunCalc from 'suncalc';
import { DayForecast, HourlyPoint } from '../models/forecast.model';

// Approximate location — set to your city-level coordinates
const LAT = 48.12;
const LON = 11.53;
const P_RATED = 225;
const G_STC = 1000;
const ALBEDO = 0.1;
const HORIZON_BRIGHT = 0.075;
const DE_DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    shortwave_radiation: number[];
    diffuse_radiation: number[];
    cloud_cover: number[];
  };
  daily: {
    time: string[];
    sunrise: string[];
    sunset: string[];
  };
}

@Injectable({ providedIn: 'root' })
export class SolarForecastService {
  private http = inject(HttpClient);

  getForecast(): Observable<DayForecast[]> {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${LAT}&longitude=${LON}` +
      `&hourly=shortwave_radiation,diffuse_radiation,cloud_cover` +
      `&daily=sunrise,sunset` +
      `&timezone=UTC` +
      `&forecast_days=7`;
    return this.http.get<OpenMeteoResponse>(url).pipe(map(r => this.parseResponse(r)));
  }

  private relativeRadiation(elev: number, az: number, tiltPanel: number, azPanel: number): number {
    if (elev <= 0) return 0;
    const tiltH = Math.PI / 2 - tiltPanel;
    const cosAoi =
      Math.sin(elev) * Math.cos(tiltH) +
      Math.cos(elev) * Math.sin(tiltH) * Math.cos(az - azPanel);
    return Math.max(cosAoi, 0);
  }

  private panelIrradiance(
    elev: number, az: number, ghi: number, dhi: number,
    tiltPanel: number, azPanel: number
  ): number {
    const tiltH = Math.PI / 2 - tiltPanel;
    const sinElev = Math.max(Math.sin(elev), Math.sin((5 * Math.PI) / 180));
    const ghiBeam = Math.max(ghi - dhi, 0);
    const cosAoi = this.relativeRadiation(elev, az, tiltPanel, azPanel);
    const Rb = cosAoi / sinElev;
    const skyView = (1 + Math.cos(tiltH)) / 2;
    return ghiBeam * Rb + dhi * (skyView + HORIZON_BRIGHT * Math.sin(tiltH)) + ghi * ALBEDO * (1 - Math.cos(tiltH)) / 2;
  }

  private balconyPower(elev: number, az: number, ghi: number, dhi: number): number {
    const east = this.panelIrradiance(elev, az, ghi, dhi, 0, -Math.PI / 2);
    const south = this.panelIrradiance(elev, az, ghi, dhi, 0, 0);
    const west = this.panelIrradiance(elev, az, ghi, dhi, 0, Math.PI / 2);
    return (P_RATED / G_STC) * (east + 2 * south + west);
  }

  private parseResponse(r: OpenMeteoResponse): DayForecast[] {
    const days: DayForecast[] = [];

    for (let d = 0; d < r.daily.time.length; d++) {
      const date = new Date(r.daily.time[d] + 'T00:00:00Z');
      const sunrise = new Date(r.daily.sunrise[d] + ':00Z');
      const sunset = new Date(r.daily.sunset[d] + ':00Z');

      const label = DE_DAYS[date.getUTCDay()];
      const dateLabel =
        String(date.getUTCDate()).padStart(2, '0') + '.' +
        String(date.getUTCMonth() + 1).padStart(2, '0') + '.';

      const hours: HourlyPoint[] = [];
      let totalKwh = 0;
      let clearSkyKwh = 0;
      let cloudSum = 0;

      for (let h = 0; h < 24; h++) {
        const idx = d * 24 + h;
        const startOfHour = new Date(r.hourly.time[idx] + ':00Z');
        const midHour = new Date(startOfHour.getTime() + 30 * 60 * 1000);
        const ghi = r.hourly.shortwave_radiation[idx] ?? 0;
        const dhi = r.hourly.diffuse_radiation[idx] ?? 0;
        const cloud = r.hourly.cloud_cover[idx] ?? 0;

        const pos = SunCalc.getPosition(midHour, LAT, LON);
        const elev = pos.altitude;
        const az = pos.azimuth;

        const forecastW = elev > 0 ? this.balconyPower(elev, az, ghi, dhi) : 0;
        const csGhi = Math.max(0, Math.sin(elev)) * 900;
        const csDhi = csGhi * 0.12;
        const potentialW = elev > 0 ? this.balconyPower(elev, az, csGhi, csDhi) : 0;

        hours.push({ hour: h, forecastW, potentialW, cloudPct: cloud, directW: Math.max(0, ghi - dhi), diffuseW: dhi });
        totalKwh += forecastW / 1000;
        clearSkyKwh += potentialW / 1000;
        cloudSum += cloud;
      }

      days.push({ date, label, dateLabel, totalKwh, clearSkyKwh, cloudPct: cloudSum / 24, sunrise, sunset, hours });
    }

    return days;
  }
}
