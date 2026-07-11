import { Activity, RadioTower, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  getGatewayEventDotClass,
  getGatewayEventLabelKey,
  getGatewayEventTone,
  type GatewayEventFilter,
} from '@/features/gateway/gatewayHelpers';
import type { GatewayLog } from '@/types';

export function GatewayLogContent({
  logs,
  totalLogs,
  eventCounts,
  filter,
  page,
  totalPages,
  onFilterChange,
  onPreviousPage,
  onNextPage,
}: {
  logs: GatewayLog[];
  totalLogs: number;
  eventCounts: Record<string, number>;
  filter: GatewayEventFilter;
  page: number;
  totalPages: number;
  onFilterChange: (filter: GatewayEventFilter) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  const { t } = useTranslation();

  const filterOptions: { value: GatewayEventFilter; labelKey: string }[] = [
    { value: 'all', labelKey: 'gateway.filterAll' },
    { value: 'connected', labelKey: 'gateway.filterConnected' },
    { value: 'disconnected', labelKey: 'gateway.filterDisconnected' },
    { value: 'heartbeat', labelKey: 'gateway.filterHeartbeat' },
    { value: 'data_sync', labelKey: 'gateway.filterDataSync' },
  ];

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="size-3.5 text-muted-foreground" />
          {t('gateway.connectionHistory')}
        </CardTitle>
        {totalLogs > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {t('gateway.eventCount', { count: totalLogs })}
          </span>
        )}
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onFilterChange(opt.value)}
              className={cn(
                'inline-flex h-6 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium leading-none transition-colors',
                filter === opt.value
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:bg-white/[0.06] hover:text-foreground',
              )}
            >
              {t(opt.labelKey)}
              <span className="ml-1 tabular-nums opacity-60">{eventCounts[opt.value] ?? 0}</span>
            </button>
          ))}
        </div>

        {logs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Activity className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t('gateway.noLogs')}</p>
            <p className="text-xs text-muted-foreground/60">{t('gateway.noLogsDescription')}</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border/30">
              {logs.map((log) => {
                const tone = getGatewayEventTone(log.event);
                return (
                  <div key={log.id} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
                    <span className="mt-1 shrink-0">
                      {tone === 'green' ? (
                        <RadioTower className="size-3.5 text-emerald-500 dark:text-emerald-400" />
                      ) : tone === 'red' ? (
                        <WifiOff className="size-3.5 text-red-500 dark:text-red-400" />
                      ) : (
                        <span className={cn('grid size-2 rounded-full', getGatewayEventDotClass(log.event))} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">
                            {t(getGatewayEventLabelKey(log.event))}
                          </p>
                          {log.detail && <p className="truncate text-[0.65rem] text-muted-foreground">{log.detail}</p>}
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

            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 0}
                  onClick={onPreviousPage}
                  className="h-7 px-2 text-xs"
                >
                  {t('gateway.previous')}
                </Button>
                <span className="tabular-nums">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={onNextPage}
                  className="h-7 px-2 text-xs"
                >
                  {t('gateway.next')}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </>
  );
}
