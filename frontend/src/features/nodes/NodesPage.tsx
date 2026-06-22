import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFarmSummary } from '@/features/farms/queries';
import { getNodeStatusBadge } from '@/lib/status';
import { timeAgo } from '@/lib/format';
import { StatusPill } from '@/components/ui/status-pill';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

  const nodes = summary.nodes.map((ns) => ns.node);

  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('nodes.colNode')}</TableHead>
              <TableHead>{t('nodes.colLocation')}</TableHead>
              <TableHead>{t('nodes.colStatus')}</TableHead>
              <TableHead>{t('nodes.colBattery')}</TableHead>
              <TableHead>RSSI LoRa</TableHead>
              <TableHead>{t('nodes.colLastUpdate')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t('nodes.empty')}
                </TableCell>
              </TableRow>
            ) : (
              nodes.map((node) => {
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
