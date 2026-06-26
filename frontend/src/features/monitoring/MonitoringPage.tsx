import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { useFarmSummary } from '@/features/farms/queries';
import { useReadings } from './queries';
import { getNodeStatusBadge, isMock } from '@/lib/status';
import { DEG_C, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FarmSummaryError } from '@/components/FarmSummaryError';
import { StatusPill, type PillTone } from '@/components/ui/status-pill';
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

// CATATAN: backend tidak menyimpan riwayat baterai (tabel readings tanpa kolom battery).
// Tampilkan nilai terkini saja. Grafik historis menyusul jika backend menambah kolom/endpoint riwayat baterai.
function batteryTone(pct: number): PillTone {
  if (pct < 20) return 'red';
  if (pct <= 50) return 'yellow';
  return 'green';
}

function ReadingRow({ reading, nodeName }: { reading: Reading; nodeName: string }) {
  const { t } = useTranslation();
  const badge = getNodeStatusBadge('online');
  return (
    <TableRow>
      <TableCell className="tabular-nums">{formatTimeLabel(reading.created_at) || '—'}</TableCell>
      <TableCell>{nodeName}</TableCell>
      <TableCell className="tabular-nums">{reading.soil_moisture}%</TableCell>
      <TableCell className="tabular-nums">
        {reading.soil_temp}
        {DEG_C}
      </TableCell>
      <TableCell className="tabular-nums">
        {reading.air_temp}
        {DEG_C}
      </TableCell>
      <TableCell className="tabular-nums">{reading.air_humidity}%</TableCell>
      <TableCell>
        <StatusPill tone={badge.tone} label={t(badge.labelKey)} />
      </TableCell>
    </TableRow>
  );
}

export default function MonitoringPage() {
  const { id: farmId } = useParams();
  const { t } = useTranslation();
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
      <FarmSummaryError
        message={
          summaryError
            ? t('monitoring.errorLoadFarm', { message: summaryError.message })
            : t('monitoring.noData')
        }
      />
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
  const isMockData = isMock(summary);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Node</span>
              {isMockData && <StatusPill tone="yellow" label="Data Contoh" />}
            </div>
            <Select value={effectiveNodeId} onValueChange={setPicked} disabled={!nodes.length}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder={nodes.length ? t('monitoring.selectNode') : t('monitoring.noNodes')} />
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
            {t('monitoring.reload')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('monitoring.batteryTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('monitoring.batteryEmpty')}</p>
          ) : (
            <ul className="space-y-3">
              {summary.nodes.map((ns) => {
                const bat = ns.node.battery;
                const pct = bat != null ? Math.min(Math.max(bat, 0), 100) : null;
                const tone = pct != null ? batteryTone(pct) : 'neutral';
                return (
                  <li key={ns.node.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">
                        {ns.node.name || ns.node.id}
                        {ns.node.location ? (
                          <span className="ml-1.5 font-normal text-muted-foreground">
                            {ns.node.location}
                          </span>
                        ) : null}
                      </span>
                      {pct != null ? (
                        <StatusPill tone={tone} label={`${pct}%`} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    {pct != null && (
                      <>
                        <div
                          className="h-2 w-full overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          {/* lebar bar = nilai dinamis → inline style untuk width diperbolehkan */}
                          <div
                            className={cn(
                              'h-full rounded-full',
                              tone === 'green' && 'bg-emerald-500',
                              tone === 'yellow' && 'bg-amber-500',
                              tone === 'red' && 'bg-red-500',
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0%</span>
                          <span>100%</span>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {readingsError ? (
        <p className="text-destructive">{t('monitoring.errorLoadReadings', { message: readingsError.message })}</p>
      ) : readingsLoading && readings.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : readings.length === 0 ? (
        <p className="text-muted-foreground">{t('monitoring.emptyReadings')}</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <MetricChart
              title={t('monitoring.chartSoilMoisture')}
              data={point('soil_moisture')}
              colorVar="var(--chart-1)"
              yDomain={[0, 100]}
              unit="%"
            />
            <MetricChart
              title={t('monitoring.chartSoilTemp')}
              data={point('soil_temp')}
              colorVar="var(--chart-2)"
              yDomain={[15, 45]}
              unit={DEG_C}
            />
            <MetricChart
              title={t('monitoring.chartAirTemp')}
              data={point('air_temp')}
              colorVar="var(--chart-3)"
              yDomain={[15, 45]}
              unit={DEG_C}
            />
            <MetricChart
              title={t('monitoring.chartAirHumidity')}
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
                    <TableHead>{t('monitoring.colTime')}</TableHead>
                    <TableHead>Node</TableHead>
                    <TableHead>{t('monitoring.colSoilMoisture')}</TableHead>
                    <TableHead>{t('monitoring.colSoilTemp')}</TableHead>
                    <TableHead>{t('monitoring.colAirTemp')}</TableHead>
                    <TableHead>{t('monitoring.colAirHumidity')}</TableHead>
                    <TableHead>{t('monitoring.colStatus')}</TableHead>
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
                  {t('monitoring.lastUpdate')} {timeAgo(selectedNode.updated_at, t)}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
