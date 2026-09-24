import { TONE_CLASSES } from '@/lib/toneClasses';
import { cn } from '@/lib/utils';
import type { SemanticTone } from '@/types';

// Badge TANPA fill berwarna: surface netral halus yang menyatu dengan kartu.
// Warna status HANYA di dot kecil, sehue ring Baterai Node. Teks netral.
// 'neutral' untuk kondisi no-data / unknown.

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
  tone: SemanticTone;
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
        <span
          className={cn('size-1.5 shrink-0 rounded-full', TONE_CLASSES[tone].dot)}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
}
