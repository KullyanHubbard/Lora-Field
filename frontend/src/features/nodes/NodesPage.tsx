import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Cpu } from 'lucide-react';
import { useFarmSummary } from '@/features/farms/queries';
import { getNodeStatusBadge } from '@/lib/status';
import { DEG_C, timeAgo } from '@/lib/format';
import { StatusPill } from '@/components/ui/status-pill';
import { Button } from '@/components/ui/button';
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

export default function NodesPage() {
  const { t } = useTranslation();
  const { id: farmId } = useParams();
  const { data: summary, isLoading, error } = useFarmSummary(farmId ?? '');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="space-y-3">
        <p className="text-destructive">
          {error ? t('nodes.errorLoad', { message: error.message }) : t('nodes.noData')}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">{t('nodes.backToDashboard')}</Link>
        </Button>
      </div>
    );
  }

  const nodeSummaries = summary.nodes;
  const isMock = summary.is_mock_data === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cpu className="size-4 text-muted-foreground" /> {t('nodes.title', 'Node Sensor')}
          {isMock && <StatusPill tone="yellow" label="Data Contoh" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('nodes.colNode')}</TableHead>
              <TableHead>{t('nodes.colLocation')}</TableHead>
              <TableHead>{t('nodes.colStatus')}</TableHead>
              <TableHead>{t('nodes.colSoilMoisture')}</TableHead>
              <TableHead>{t('nodes.colSoilTemp')}</TableHead>
              <TableHead>{t('nodes.colAirTemp')}</TableHead>
              <TableHead>{t('nodes.colAirHumidity')}</TableHead>
              <TableHead>{t('nodes.colBattery')}</TableHead>
              <TableHead>RSSI LoRa</TableHead>
              <TableHead>{t('nodes.colLastUpdate')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodeSummaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  {t('nodes.empty')}
                </TableCell>
              </TableRow>
            ) : (
              nodeSummaries.map((ns) => {
                const node = ns.node;
                // latest_reading BISA null (node tanpa reading) → semua kolom sensor "—"
                const reading = ns.latest_reading;
                const badge = getNodeStatusBadge(node.status);
                return (
                  <TableRow key={node.id}>
                    <TableCell className="font-medium text-foreground">
                      {node.name || node.id}
                    </TableCell>
                    <TableCell>{node.location || '—'}</TableCell>
                    <TableCell>
                      <StatusPill tone={badge.tone} label={t(badge.labelKey)} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {reading ? `${reading.soil_moisture}%` : '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {reading ? `${reading.soil_temp}${DEG_C}` : '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {reading ? `${reading.air_temp}${DEG_C}` : '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {reading ? `${reading.air_humidity}%` : '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {node.battery != null ? `${node.battery}%` : '—'}
                    </TableCell>
                    {/* RSSI tidak disimpan backend (tidak ada di type Node) → selalu "—" */}
                    <TableCell className="tabular-nums text-muted-foreground">—</TableCell>
                    <TableCell className="text-muted-foreground">
                      {timeAgo(node.updated_at, t)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
