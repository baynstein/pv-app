export interface HourlyPoint {
  hour: number;
  forecastW: number;
  potentialW: number;
  cloudPct: number;
  directW: number;   // beam horizontal irradiance (GHI − DHI) in W/m²
  diffuseW: number;  // diffuse horizontal irradiance (DHI) in W/m²
}

export interface DayForecast {
  date: Date;
  label: string;
  dateLabel: string;
  totalKwh: number;
  clearSkyKwh: number;
  cloudPct: number;
  sunrise: Date;
  sunset: Date;
  hours: HourlyPoint[];
}
