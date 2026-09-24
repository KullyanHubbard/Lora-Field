import type { SemanticTone } from '@/types';

// Warna per tone status di satu tempat. Kelas ditulis utuh (bukan dirakit dari
// string) supaya tetap terbaca Tailwind.
export const TONE_CLASSES: Record<
  SemanticTone,
  { dot: string; stroke: string; text: string; glow: string }
> = {
  green: {
    dot: 'bg-emerald-500 dark:bg-emerald-400',
    stroke: 'stroke-emerald-500 dark:stroke-emerald-400',
    text: 'text-emerald-500 dark:text-emerald-400',
    glow: 'bg-emerald-500/15 dark:bg-emerald-400/12',
  },
  yellow: {
    dot: 'bg-amber-500 dark:bg-amber-400',
    stroke: 'stroke-amber-500 dark:stroke-amber-400',
    text: 'text-amber-500 dark:text-amber-400',
    glow: 'bg-amber-500/15 dark:bg-amber-400/12',
  },
  red: {
    dot: 'bg-red-500 dark:bg-red-400',
    stroke: 'stroke-red-500 dark:stroke-red-400',
    text: 'text-red-500 dark:text-red-400',
    glow: 'bg-red-500/15 dark:bg-red-400/12',
  },
  neutral: {
    dot: 'bg-muted-foreground/50',
    stroke: 'stroke-foreground/30',
    text: 'text-muted-foreground',
    glow: '',
  },
};
