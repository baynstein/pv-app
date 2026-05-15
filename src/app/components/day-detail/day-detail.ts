import {
  Component,
  input,
  computed,
  effect,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { DayForecast } from '../../models/forecast.model';

Chart.register(...registerables);

// For a 270° arc with gap at the bottom:
// - circle starts stroke at east (3 o'clock) by default
// - rotate(135°) shifts start to 7:30 (bottom-left)
// - 270° sweep = 75% of circumference
const R = 42;
const CIRCUMFERENCE = 2 * Math.PI * R;      // ≈ 263.89
const ARC_LENGTH = CIRCUMFERENCE * 0.75;    // ≈ 197.92

const SHARED_SCALE_OPTS = {
  x: {
    stacked: true,
    grid: { display: false },
    ticks: { font: { size: 10 }, maxRotation: 0 },
  },
};

@Component({
  selector: 'app-day-detail',
  standalone: true,
  imports: [],
  templateUrl: './day-detail.html',
  styleUrl: './day-detail.scss',
})
export class DayDetail implements AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('radCanvas')   radRef!:   ElementRef<HTMLCanvasElement>;

  readonly day = input.required<DayForecast>();

  readonly kwhRatio = computed(() => {
    const d = this.day();
    return d.clearSkyKwh === 0 ? 0 : Math.min(d.totalKwh / d.clearSkyKwh, 1);
  });

  readonly cloudRatio = computed(() => this.day().cloudPct / 100);

  readonly kwhDashArray = computed(() => {
    const fill = this.kwhRatio() * ARC_LENGTH;
    return `${fill.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`;
  });

  readonly cloudDashArray = computed(() => {
    const fill = this.cloudRatio() * ARC_LENGTH;
    return `${fill.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`;
  });

  readonly trackDashArray = `${ARC_LENGTH.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`;

  readonly qualityLabel = computed(() => {
    const pct = this.day().cloudPct;
    if (pct < 20) return 'Sehr gut';
    if (pct < 40) return 'Gut';
    if (pct < 60) return 'Mäßig';
    if (pct < 80) return 'Bedeckt';
    return 'Schlecht';
  });

  readonly qualityDesc = computed(() => {
    const pct = this.day().cloudPct;
    if (pct < 20) return 'Klarer Himmel, optimale Ausbeute';
    if (pct < 40) return 'Überwiegend sonnig';
    if (pct < 60) return 'Teils bewölkt, eingeschränkte Ausbeute';
    if (pct < 80) return 'Stark bewölkt, geringe Ausbeute';
    return 'Dichte Wolken, sehr geringe Ausbeute';
  });

  private chart: Chart | null = null;
  private radChart: Chart | null = null;

  constructor() {
    effect(() => {
      const d = this.day();
      if (this.chart) {
        this.chart.data.datasets[0].data = d.hours.map(h => h.forecastW);
        this.chart.data.datasets[1].data = d.hours.map(h => Math.max(0, h.potentialW - h.forecastW));
        this.chart.update('none');
      }
      if (this.radChart) {
        this.radChart.data.datasets[0].data = d.hours.map(h => h.directW);
        this.radChart.data.datasets[1].data = d.hours.map(h => h.diffuseW);
        this.radChart.update('none');
      }
    });
  }

  ngAfterViewInit(): void {
    const d = this.day();
    const labels = d.hours.map(h => `${h.hour}`);

    // Power chart
    this.chart = new Chart(this.chartRef.nativeElement.getContext('2d')!, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Prognose',
            data: d.hours.map(h => h.forecastW),
            backgroundColor: '#f97316',
            borderRadius: 3,
            stack: 'power',
          },
          {
            label: 'Potenzial',
            data: d.hours.map(h => Math.max(0, h.potentialW - h.forecastW)),
            backgroundColor: 'rgba(156,163,175,0.35)',
            borderRadius: 3,
            stack: 'power',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                if (ctx.datasetIndex === 1) {
                  const forecast = (ctx.chart.data.datasets[0].data[ctx.dataIndex] as number) ?? 0;
                  return `Potenzial: ${Math.round((ctx.raw as number) + forecast)} W`;
                }
                return `Prognose: ${Math.round(ctx.raw as number)} W`;
              },
            },
          },
        },
        scales: {
          ...SHARED_SCALE_OPTS,
          y: {
            stacked: true,
            min: 0,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { size: 10 } },
            title: { display: true, text: 'Leistung (W)', font: { size: 10 }, color: '#6b7280' },
          },
        },
      },
    });

    // Radiation chart
    this.radChart = new Chart(this.radRef.nativeElement.getContext('2d')!, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Direkt',
            data: d.hours.map(h => h.directW),
            backgroundColor: '#fbbf24',
            borderRadius: 3,
            stack: 'rad',
          },
          {
            label: 'Diffus',
            data: d.hours.map(h => h.diffuseW),
            backgroundColor: 'rgba(147,197,253,0.75)',
            borderRadius: 3,
            stack: 'rad',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${Math.round(ctx.raw as number)} W/m²`,
            },
          },
        },
        scales: {
          ...SHARED_SCALE_OPTS,
          y: {
            stacked: true,
            min: 0,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { size: 10 }, callback: v => `${v}` },
            title: { display: true, text: 'Strahlung (W/m²)', font: { size: 10 }, color: '#6b7280' },
          },
        },
      },
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.radChart?.destroy();
  }

  formatTime(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Berlin',
    }).format(date);
  }
}
