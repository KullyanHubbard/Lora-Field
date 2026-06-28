import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/status';

// Tone kompatibel dengan helper lib/status.ts (return 'green' | 'yellow' | 'red')
// PLUS 'neutral' untuk kondisi no-data / unknown.
export type PillTone = StatusTone | 'neutral';

// Badge TANPA fill berwarna: surface netral halus yang menyatu dengan kartu.
// Warna status HANYA di dot kecil — SOLID NEON, sehue ring Baterai Node
// (emerald-500/-400 mint, amber-500/-400 oranye, red-500/-400). Teks netral.
const DOT: Record<PillTone, string> = {
  green: 'bg-emerald-500 dark:bg-emerald-400',
  yellow: 'bg-amber-500 dark:bg-amber-400',
  red: 'bg-red-500 dark:bg-red-400',
  neutral: 'bg-muted-foreground/50',
};

/**
 * Badge status: kotak rounded-md, surface netral (border tipis + bg netral
 * halus, TANPA warna), teks netral, dan dot neon solid di kiri sesuai tone.
 * Bentuk & ukuran font tidak berubah. `showDot={false}` bila perlu.
 */
export function StatusPill({
  tone,
  label,
  showDot = true,
  className,
}: {
  tone: PillTone;
  label: string;
  showDot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-foreground',
        className,
      )}
    >
      {showDot && (
        <span className={cn('size-1.5 shrink-0 rounded-full', DOT[tone])} aria-hidden="true" />
      )}
      {label}
    </span>
  );
}
