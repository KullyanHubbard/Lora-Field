import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getLogTone } from '@/features/logs/logHelpers';
import type { ScopedLog } from '@/features/logs/useLogsViewModel';
import { EMPTY_VALUE } from '@/lib/format';

export function LogsTableCard({
  logs,
  truncatedAt,
}: {
  logs: ScopedLog[];
  truncatedAt: number | null;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent>
        {truncatedAt != null ? (
          <p className="mb-3 text-xs text-muted-foreground">
            {t('logs.truncated', { count: truncatedAt })}
          </p>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('logs.colTime')}</TableHead>
              <TableHead>{t('logs.colNode')}</TableHead>
              <TableHead>{t('logs.colLocation')}</TableHead>
              <TableHead>{t('logs.colMoisture')}</TableHead>
              <TableHead>{t('logs.colWeather')}</TableHead>
              <TableHead>{t('logs.colDecision')}</TableHead>
              <TableHead>{t('logs.colValve')}</TableHead>
              <TableHead>{t('logs.colReason')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {t('logs.empty')}
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="tabular-nums">{log.time}</TableCell>
                  <TableCell>{log.nodeName}</TableCell>
                  <TableCell className="text-muted-foreground">{log.nodeLocation}</TableCell>
                  <TableCell className="tabular-nums">{log.soil_moisture}%</TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.weather || EMPTY_VALUE}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={getLogTone(log)} label={log.decisionLabel} />
                  </TableCell>
                  <TableCell>{log.valveLabel}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.reasonLabel || EMPTY_VALUE}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
