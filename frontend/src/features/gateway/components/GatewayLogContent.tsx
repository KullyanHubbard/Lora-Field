import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, RadioTower, WifiOff } from 'lucide-react';
import { useGatewayLogs } from '../queries';
import { timeAgo } from '@/lib/format';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const EVENT_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'connected', label: 'Terhubung' },
  { value: 'disconnected', label: 'Terputus' },
  { value: 'heartbeat', label: 'Heartbeat' },
  { value: 'data_sync', label: 'Sinkronisasi' },
] as const;

const eventDot: Record<string, string> = {
  connected: 'bg-emerald-500',
  disconnected: 'bg-red-500',
  heartbeat: 'bg-blue-500',
  data_sync: 'bg-violet-500',
};

const eventLabel: Record<string, string> = {
  connected: 'Terhubung',
  disconnected: 'Terputus',
  heartbeat: 'Heartbeat',
  data_sync: 'Sinkronisasi',
};

const PER_PAGE = 10;

export function GatewayLogContent({ farmId }: { farmId?: string }) {
  const { t } = useTranslation();
  const { data: gatewayLogs } = useGatewayLogs(farmId);
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  const rawLogs = gatewayLogs?.items ?? [];

  const filtered = useMemo(() => {
    if (filter === 'all') return rawLogs;
    return rawLogs.filter((l) => l.event === filter);
  }, [rawLogs, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageLogs = filtered.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rawLogs.length };
    for (const l of rawLogs) {
      counts[l.event] = (counts[l.event] ?? 0) + 1;
    }
    return counts;
  }, [rawLogs]);

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="size-3.5 text-muted-foreground" />
          Riwayat Koneksi
        </CardTitle>
        {filtered.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {filtered.length} event
          </span>
        )}
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {/* Filter box badges */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {EVENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setFilter(opt.value); setPage(0); }}
              className={cn(
                'inline-flex h-6 items-center gap-1 !rounded-md border px-2.5 py-1 text-xs font-medium leading-none transition-colors',
                filter === opt.value
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:bg-white/[0.06] hover:text-foreground',
              )}
            >
              {opt.label}
              <span className="ml-1 tabular-nums opacity-60">
                {eventCounts[opt.value] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Activity className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Belum ada log</p>
            <p className="text-xs text-muted-foreground/60">
              Riwayat akan muncul setelah gateway terhubung
            </p>
          </div>
        ) : (
          <>
            {/* Plain list style — no cards/boxes, divider only */}
            <div className="divide-y divide-border/30">
              {pageLogs.map((log) => {
                const tone = log.event === 'connected' || log.event === 'heartbeat' || log.event === 'data_sync'
                  ? 'green'
                  : log.event === 'disconnected'
                    ? 'red'
                    : 'neutral';
                return (
                  <div key={log.id} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
                    <span className="mt-1 shrink-0">
                      {tone === 'green' ? (
                        <RadioTower className="size-3.5 text-emerald-500 dark:text-emerald-400" />
                      ) : tone === 'red' ? (
                        <WifiOff className="size-3.5 text-red-500 dark:text-red-400" />
                      ) : (
                        <span className={cn('grid size-2 rounded-full', eventDot[log.event] ?? 'bg-muted-foreground')} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">
                            {eventLabel[log.event] ?? log.event}
                          </p>
                          {log.detail && (
                            <p className="truncate text-[0.65rem] text-muted-foreground">{log.detail}</p>
                          )}
                        </div>
                        <span className="shrink-0 tabular-nums text-[0.65rem] text-muted-foreground">
                          {timeAgo(log.created_at, t)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination — only when >1 page */}
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="h-7 px-2 text-xs"
                >
                  Sebelumnya
                </Button>
                <span className="tabular-nums">
                  {safePage + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-7 px-2 text-xs"
                >
                  Berikutnya
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </>
  );
}