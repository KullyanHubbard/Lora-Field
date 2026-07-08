import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getGatewayLogMeta } from '@/features/dashboard/dashboardHelpers';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GatewayLog } from '@/types';

export function ActivityLogCard({
  farmId,
  logs,
  isLoading,
  error,
  className,
}: {
  farmId: string;
  logs: GatewayLog[];
  isLoading: boolean;
  error: unknown;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4 shrink-0 text-violet-500 dark:text-violet-400" />
          {t('dashboard.activityLogCard')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {isLoading ? (
          <p className="py-4 text-center text-xs text-muted-foreground">{t('dashboard.loadingLogs')}</p>
        ) : error ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {t('dashboard.loadLogsError')}
          </p>
        ) : logs.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {t('dashboard.noGatewayActivity')}
          </p>
        ) : (
          <div className="flex-1 divide-y divide-border/40">
            {logs.map((log) => {
              const meta = getGatewayLogMeta(log);
              return (
                <div key={log.id} className="flex items-start gap-2 py-1.5 first:pt-0 last:pb-0">
                  <span
                    className={cn('mt-1.5 grid size-2 shrink-0 rounded-full', meta.dotClassName)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {t(meta.labelKey)}
                    </p>
                    <p className="truncate text-[0.65rem] text-muted-foreground">{log.detail}</p>
                  </div>
                  <span className="shrink-0 pt-0.5 tabular-nums text-[0.65rem] text-muted-foreground">
                    {timeAgo(log.created_at, t)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <Link
          to={`/farms/${farmId}/gateway`}
          className="mt-auto flex items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('dashboard.viewAllLogs')}
          <ChevronRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
