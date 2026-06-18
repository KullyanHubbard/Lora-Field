import { Link, useParams } from 'react-router-dom';
import { useFarmSummary } from '@/features/farms/queries';
import { getNodeStatusBadge } from '@/lib/status';
import { timeAgo } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
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
          {error ? `Gagal memuat data node: ${error.message}` : 'Data tidak tersedia.'}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">Kembali ke Daftar Kebun</Link>
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
              <TableHead>Node</TableHead>
              <TableHead>Lokasi Titik</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Baterai</TableHead>
              <TableHead>RSSI LoRa</TableHead>
              <TableHead>Update Terakhir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Belum ada node terdaftar untuk kebun ini.
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
                      <StatusBadge label={badge.label} tone={badge.tone} />
                    </TableCell>
                    <TableCell className="font-mono">
                      {node.battery != null ? `${node.battery}%` : '—'}
                    </TableCell>
                    {/* RSSI tidak disimpan backend (tidak ada di type Node) → selalu "—" */}
                    <TableCell className="font-mono text-muted-foreground">—</TableCell>
                    <TableCell className="text-muted-foreground">
                      {timeAgo(node.updated_at)}
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
