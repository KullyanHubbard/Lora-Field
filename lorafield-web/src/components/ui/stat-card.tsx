import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: ReactNode;
  trend?: { value: string; positive: boolean };
  className?: string;
}

/**
 * Kartu statistik: angka jadi fokus (besar, tipis), label kecil & muted.
 * "Tampilkan, jangan jelaskan" — lihat docs/DESIGN.md.
 */
export function StatCard({ label, value, sublabel, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      {(sublabel || trend) && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                'font-medium tabular-nums',
                trend.positive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {trend.value}
            </span>
          )}
          {sublabel && <span className="text-muted-foreground">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}
