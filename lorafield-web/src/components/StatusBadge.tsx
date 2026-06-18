import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/status';

// KONVENSI WARNA BADGE STATUS (disepakati) — pakai utility Tailwind langsung,
// konsisten di SEMUA halaman. Jangan re-inline kelasnya per page; import dari sini.
// Tokenisasi tema (--success/--warning) ditunda ke fase polish akhir.
export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  green: 'border-transparent bg-emerald-600 text-white',
  yellow: 'border-transparent bg-amber-500 text-black',
  red: 'border-transparent bg-red-600 text-white',
};

export function StatusBadge({
  label,
  tone,
  className,
}: {
  label: string;
  tone: StatusTone;
  className?: string;
}) {
  return <Badge className={cn(STATUS_TONE_CLASS[tone], className)}>{label}</Badge>;
}
