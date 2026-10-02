import type { SemanticTone } from '@/types';

// Warna per tone status di satu tempat. Kelas ditulis utuh (bukan dirakit dari
// string) supaya tetap terbaca Tailwind.
export const TONE_CLASSES: Record<
  SemanticTone,
  { dot: string; stroke: string; text: string; glow: string }
> = {
  green: {
    dot: 'bg-emerald-400',
    stroke: 'stroke-emerald-400',
    text: 'text-emerald-400',
    glow: 'bg-emerald-400/12',
  },
  yellow: {
    dot: 'bg-amber-400',
    stroke: 'stroke-amber-400',
    text: 'text-amber-400',
    glow: 'bg-amber-400/12',
  },
  red: {
    dot: 'bg-red-400',
    stroke: 'stroke-red-400',
    text: 'text-red-400',
    glow: 'bg-red-400/12',
  },
  neutral: {
    dot: 'bg-muted-foreground/50',
    stroke: 'stroke-foreground/30',
    text: 'text-muted-foreground',
    glow: '',
  },
};

// Warna aksen ikon dan elemen dekoratif (bukan status). Semua kelas palet Tailwind
// di luar komponen shadcn ada di file ini supaya gampang diganti ke token tema.
export const ACCENT_TEXT = {
  amber: 'text-amber-400',
  blue: 'text-blue-400',
  cyan: 'text-cyan-400',
  emerald: 'text-emerald-400',
  orange: 'text-orange-400',
  red: 'text-red-400',
  sky: 'text-sky-400',
  violet: 'text-violet-400',
} as const;

export const ACCENT_BG = {
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  red: 'bg-red-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
} as const;

// Aksen per metrik sensor, dipakai kartu metrik dan kartu Node Sensor.
export const METRIC_ACCENT_TEXT = {
  soil_moisture: ACCENT_TEXT.cyan,
  soil_temp: ACCENT_TEXT.orange,
  air_temp: ACCENT_TEXT.amber,
  air_humidity: ACCENT_TEXT.sky,
} as const;

export const NOTICE_CLASSES = {
  warningText: 'text-amber-400',
  warningBorder: 'border-amber-500/50',
  warningCard: 'border-amber-500/20 bg-amber-500/10',
  successPill: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  rainHighlight: 'bg-blue-500/10',
} as const;
