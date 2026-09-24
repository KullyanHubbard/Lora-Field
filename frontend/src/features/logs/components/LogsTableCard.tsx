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
import { getDecisionTone, LOG_TYPE_LABEL } from '@/features/logs/logHelpers';
import type { ScopedLog } from '@/features/logs/useLogsViewModel';
import { EMPTY_VALUE } from '@/lib/format';

export function LogsTableCard({ logs }: { logs: ScopedLog[] }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent>
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
                  <TableCell className="text-muted-foreground">{log.weather || EMPTY_VALUE}</TableCell>
                  <TableCell>
                    <StatusPill
                      tone={getDecisionTone(log.type)}
                      label={t(LOG_TYPE_LABEL[log.type])}
                    />
                  </TableCell>
                  <TableCell>{log.valveLabel}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.reason || EMPTY_VALUE}
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
