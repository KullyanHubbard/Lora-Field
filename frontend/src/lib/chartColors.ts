// Warna grafik diambil dari variabel CSS --chart-* di index.css, bukan hex di JS.
// Bisa dipakai langsung di prop Recharts (fill/stroke) dan ChartConfig.
export const CHART_COLORS = {
  cyan: 'var(--chart-cyan)',
  emerald: 'var(--chart-emerald)',
  red: 'var(--chart-red)',
  blue: 'var(--chart-blue)',
  orange: 'var(--chart-orange)',
  amber: 'var(--chart-amber)',
  violet: 'var(--chart-violet)',
  violetSoft: 'var(--chart-violet-soft)',
  sky: 'var(--chart-sky)',
  dotRing: 'var(--chart-dot-ring)',
} as const;

// Garis grafik kartu metrik per sensor. Punya nilai terpisah di .dark.
export const METRIC_CHART_COLORS = {
  soil_moisture: 'var(--chart-metric-soil-moisture)',
  soil_temp: 'var(--chart-metric-soil-temp)',
  air_temp: 'var(--chart-metric-air-temp)',
  air_humidity: 'var(--chart-metric-air-humidity)',
} as const;
