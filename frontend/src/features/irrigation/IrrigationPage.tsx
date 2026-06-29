import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFarmSummary } from '@/features/farms/queries';
import { valveKeyFromDecision } from '@/features/farms/farmHelpers';
import { getIrrigationStatusBadge, getValveStatusBadge } from '@/lib/status';
import { StatusPill } from '@/components/ui/status-pill';
import { FarmSummaryError } from '@/components/FarmSummaryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function IrrigationPage() {
  const { id: farmId } = useParams();
  const { t } = useTranslation();
  const { data: summary, isLoading, error } = useFarmSummary(farmId ?? '');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <FarmSummaryError
        message={
          error ? t('irrigation.errorLoad', { message: error.message }) : t('irrigation.noData')
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('irrigation.perNodeTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('irrigation.colNode')}</TableHead>
                <TableHead>{t('irrigation.colMoisture')}</TableHead>
                <TableHead>{t('irrigation.colDecision')}</TableHead>
                <TableHead>{t('irrigation.colValve')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.nodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t('irrigation.perNodeEmpty')}
                  </TableCell>
                </TableRow>
              ) : (
                summary.nodes.map((ns) => {
                  const reading = ns.latest_reading;
                  const dec = ns.decision;
                  const irrBadge = dec ? getIrrigationStatusBadge(dec.decision) : null;
                  const valveBadge = dec ? getValveStatusBadge(valveKeyFromDecision(dec)) : null;
                  return (
                    <TableRow key={ns.node.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {ns.node.name || ns.node.id}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {ns.node.location || ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {reading ? `${reading.soil_moisture}%` : '—'}
                      </TableCell>
                      <TableCell>
                        {irrBadge ? (
                          <StatusPill tone={irrBadge.tone} label={t(irrBadge.labelKey)} />
                        ) : (
                          <StatusPill tone="neutral" label={t('irrigation.waitingData')} />
                        )}
                      </TableCell>
                      <TableCell>
                        {valveBadge ? (
                          <StatusPill tone={valveBadge.tone} label={t(valveBadge.labelKey)} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}