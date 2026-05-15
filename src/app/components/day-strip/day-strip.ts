import { Component, input, output } from '@angular/core';
import { DayForecast } from '../../models/forecast.model';

@Component({
  selector: 'app-day-strip',
  standalone: true,
  imports: [],
  templateUrl: './day-strip.html',
  styleUrl: './day-strip.scss',
})
export class DayStrip {
  readonly days = input<DayForecast[]>([]);
  readonly selectedIndex = input(0);
  readonly daySelected = output<number>();

  select(i: number): void {
    this.daySelected.emit(i);
  }

  fillRatio(day: DayForecast): number {
    if (day.clearSkyKwh === 0) return 0;
    return Math.min(day.totalKwh / day.clearSkyKwh, 1);
  }
}
