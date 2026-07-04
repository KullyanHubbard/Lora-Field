import { Droplet, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValveSummary } from '@/features/farms/farmDetailHelpers';

export function ValveStatCard({
  summary,
  className,
}: {
  summary: ValveSummary;
  className?: string;
}) {
  const { bars, totalCount, openCount, closedCount, offlineCount } = summary;

  return (
    <div className={cn('flex flex-col rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex items-center gap-2">
        <Droplet className="size-4 shrink-0 text-cyan-500 dark:text-cyan-400" />
        <span className="text-sm font-medium text-foreground">Status Valve</span>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
          Otomatis
        </span>
        <Zap className="size-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
      </div>

      <div className="mt-3 space-y-2.5">
        {totalCount > 0 ? (
          <div className="flex gap-1" aria-hidden="true">
            {bars.map((color, index) => (
              <span
                key={index}
                className={cn('h-2 flex-1 rounded-full transition-opacity hover:opacity-80', color)}
              />
            ))}
          </div>
        ) : (
          <div className="h-2 w-full rounded-full bg-muted" aria-hidden="true" />
        )}

        {totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                <span className="tabular-nums text-foreground">{openCount}</span>
                <span className="text-muted-foreground">buka</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-amber-500" />
                <span className="tabular-nums text-foreground">{closedCount}</span>
                <span className="text-muted-foreground">tutup</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-red-500" />
                <span className="tabular-nums text-foreground">{offlineCount}</span>
                <span className="text-muted-foreground">offline</span>
              </span>
            </div>
            <span className="tabular-nums text-muted-foreground">
              {openCount}/{totalCount} terbuka
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
