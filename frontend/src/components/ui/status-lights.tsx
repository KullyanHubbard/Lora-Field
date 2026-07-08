import { cn } from '@/lib/utils';

// Tone lampu status kebun. Termasuk 'neutral' (abu-abu) untuk status tak dikenal.
export type LightTone = 'green' | 'yellow' | 'red' | 'neutral';

const LIGHT_COLORS: Record<LightTone, { on: string; off: string; glow: string }> = {
  green:   { on: 'bg-emerald-400', off: 'bg-emerald-500/25', glow: 'shadow-[0_0_7px_2px_rgba(16,185,129,0.75)]' },
  yellow:  { on: 'bg-amber-400',   off: 'bg-amber-400/25',   glow: 'shadow-[0_0_5px_1px_rgba(251,191,36,0.55)]' },
  red:     { on: 'bg-red-500',     off: 'bg-red-500/25',     glow: 'shadow-[0_0_5px_1px_rgba(239,68,68,0.55)]' },
  neutral: { on: 'bg-muted-foreground', off: 'bg-muted-foreground/20', glow: '' },
};

// Urutan lampu fisik (merah - kuning - hijau), seperti lampu lalu lintas.
const LIGHT_ORDER: LightTone[] = ['red', 'yellow', 'green'];

/**
 * Sistem lampu status: tiga titik (merah/kuning/hijau); satu menyala sesuai tone.
 * Lampu visual `aria-hidden`; bila `label` diisi, ditambahkan teks `sr-only`
 * agar status tetap terbaca screen reader.
 */
export function StatusLights({
  tone,
  label,
  className,
}: {
  tone: LightTone;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      <span className="flex items-center gap-1" aria-hidden="true">
        {LIGHT_ORDER.map((t) => {
          const active = t === tone;
          const { on, off, glow } = LIGHT_COLORS[t];
          return (
            <span
              key={t}
              className={cn('size-2 rounded-full', active ? `${on} ${glow}` : off)}
            />
          );
        })}
      </span>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
