import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { useFarmSummary } from '@/features/farms/queries';
import { useReadings } from './queries';
import { getNodeStatusBadge } from '@/lib/status';
import { DEG_C, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Reading } from '@/types';

function formatTimeLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

interface ChartPoint {
  label: string;
  value: number;
}

function MetricChart({
  title,
  data,
  colorVar,
  yDomain,
  unit,
}: {
  title: string;
  data: ChartPoint[];
  colorVar: string;
  yDomain: [number, number];
  unit: string;
}) {
  const config = {
    value: { label: title, color: colorVar },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[200px] w-full">
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
            />
            <YAxis
              domain={yDomain}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v) => `${v}${unit}`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              fill="var(--color-value)"
              fillOpacity={0.18}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function ReadingRow({ reading, nodeName }: { reading: Reading; nodeName: string }) {
  const badge = getNodeStatusBadge('online');
  return (
    <TableRow>
      <TableCell className="font-mono">{formatTimeLabel(reading.created_at) || '—'}</TableCell>
      <TableCell>{nodeName}</TableCell>
      <TableCell className="font-mono">{reading.soil_moisture}%</TableCell>
      <TableCell className="font-mono">
        {reading.soil_temp}
        {DEG_C}
      </TableCell>
      <TableCell className="font-mono">
        {reading.air_temp}
        {DEG_C}
      </TableCell>
      <TableCell className="font-mono">{reading.air_humidity}%</TableCell>
      <TableCell>
        <StatusBadge label={badge.label} tone={badge.tone} />
      </TableCell>
    </TableRow>
  );
}

export default function MonitoringPage() {
  const { id: farmId } = useParams();
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useFarmSummary(
    farmId ?? '',
  );

  const [picked, setPicked] = useState('');
  const nodes = summary?.nodes.map((ns) => ns.node) ?? [];
  const firstNodeId = nodes[0]?.id ?? '';
  const effectiveNodeId = picked || firstNodeId;

  const {
    data: readingsData,
    isLoading: readingsLoading,
    isFetching: readingsFetching,
    error: readingsError,
    refetch,
  } = useReadings(effectiveNodeId, 20);

  if (summaryLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (summaryError || !summary) {
    return (
      <div className="space-y-3">
        <p className="text-destructive">
          {summaryError
            ? `Gagal memuat data kebun: ${summaryError.message}`
            : 'Data tidak tersedia.'}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">Kembali ke Daftar Kebun</Link>
        </Button>
      </div>
    );
  }

  const readings = readingsData?.items ?? [];
  // Chart: lama → baru (kiri ke kanan). Tabel: baru → lama (apa adanya dari API).
  const readingsAsc = [...readings].reverse();
  const point = (key: keyof Reading): ChartPoint[] =>
    readingsAsc.map((r) => ({ label: formatTimeLabel(r.created_at), value: Number(r[key]) }));

  const selectedNode = nodes.find((n) => n.id === effectiveNodeId) ?? null;
  const nodeName = selectedNode
    ? `${selectedNode.name}${selectedNode.location ? ` - ${selectedNode.location}` : ''}`
    : '—';
  const tableRows = readings.slice(0, 10);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Node</span>
            <Select value={effectiveNodeId} onValueChange={setPicked} disabled={!nodes.length}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder={nodes.length ? 'Pilih node' : 'Tidak ada node'} />
              </SelectTrigger>
              <SelectContent>
                {nodes.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                    {n.location ? ` - ${n.location}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={!effectiveNodeId || readingsFetching}
          >
            <RefreshCw className={cn('size-4', readingsFetching && 'animate-spin')} />
            Muat Ulang Data
          </Button>
        </CardContent>
      </Card>

      {readingsError ? (
        <p className="text-destructive">Gagal memuat pembacaan: {readingsError.message}</p>
      ) : readingsLoading && readings.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : readings.length === 0 ? (
        <p className="text-muted-foreground">Belum ada data pembacaan sensor untuk node ini.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <MetricChart
              title="Kelembapan Tanah"
              data={point('soil_moisture')}
              colorVar="var(--chart-1)"
              yDomain={[0, 100]}
              unit="%"
            />
            <MetricChart
              title="Suhu Tanah"
              data={point('soil_temp')}
              colorVar="var(--chart-2)"
              yDomain={[15, 45]}
              unit={DEG_C}
            />
            <MetricChart
              title="Suhu Udara"
              data={point('air_temp')}
              colorVar="var(--chart-3)"
              yDomain={[15, 45]}
              unit={DEG_C}
            />
            <MetricChart
              title="Kelembapan Udara"
              data={point('air_humidity')}
              colorVar="var(--chart-4)"
              yDomain={[0, 100]}
              unit="%"
            />
          </div>

          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Node</TableHead>
                    <TableHead>Kelembapan Tanah</TableHead>
                    <TableHead>Suhu Tanah</TableHead>
                    <TableHead>Suhu Udara</TableHead>
                    <TableHead>Kelembapan Udara</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((r) => (
                    <ReadingRow key={r.id} reading={r} nodeName={nodeName} />
                  ))}
                </TableBody>
              </Table>
              {selectedNode && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Last update node: {timeAgo(selectedNode.updated_at)}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
