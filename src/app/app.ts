import { Component, signal, inject, OnInit } from '@angular/core';
import { SolarForecastService } from './services/solar-forecast.service';
import { DayForecast } from './models/forecast.model';
import { DayStrip } from './components/day-strip/day-strip';
import { DayDetail } from './components/day-detail/day-detail';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DayStrip, DayDetail],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private svc = inject(SolarForecastService);

  protected forecasts = signal<DayForecast[] | null>(null);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected selectedDay = signal(0);

  ngOnInit(): void {
    this.svc.getForecast().subscribe({
      next: days => {
        this.forecasts.set(days);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Wetterdaten konnten nicht geladen werden.');
        this.loading.set(false);
      },
    });
  }
}
