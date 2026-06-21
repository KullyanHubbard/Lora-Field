import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/status';

// Tone kompatibel dengan helper lib/status.ts (return 'green' | 'yellow' | 'red')
// PLUS 'neutral' untuk kondisi no-data / unknown (abu-abu, bukan merah).
// Catatan: token tone-nya 'yellow' (bukan 'amber'); warna render-nya amber.
export type PillTone = StatusTone | 'neutral';

const TONE: Record<PillTone, { wrap: string; dot: string }> = {
  green: { wrap: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  yellow: { wrap: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  red: { wrap: 'bg-red-500/10 text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  neutral: { wrap: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/40' },
};

/**
 * Badge status SUBTLE: background tone tipis + teks berwarna + dot kecil.
 * Pengganti StatusBadge solid (lihat docs/DESIGN.md). Pakai tone dari helper
 * lib/status.ts; pakai 'neutral' untuk no-data / belum ada (BUKAN merah).
 */
export function StatusPill({
  tone,
  label,
  className,
}: {
  tone: PillTone;
  label: string;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        t.wrap,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', t.dot)} aria-hidden="true" />
      {label}
    </span>
  );
}
