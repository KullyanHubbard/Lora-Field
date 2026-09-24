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
