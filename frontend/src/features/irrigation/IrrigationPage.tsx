import { Droplets, Gauge, Radio, Timer, Waves } from 'lucide-react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFarmSummary } from '@/features/farms/queries';
import { getFarmLastUpdate, valveKeyFromDecision } from '@/features/farms/farmHelpers';
import { getIrrigationStatusBadge, getValveStatusBadge } from '@/lib/status';
import { StatusPill } from '@/components/ui/status-pill';
import { FarmSummaryError } from '@/components/FarmSummaryError';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { NodeSummary } from '@/types';

function formatSyncTime(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function moistureCondition(value: number | null, lower: number, upper: number) {
  if (value == null) return { label: 'Menunggu data', tone: 'neutral' as const, bar: 'bg-muted' };
  if (value < lower * 0.75) return { label: 'Critical', tone: 'red' as const, bar: 'bg-red-500' };
  if (value < lower) return { label: 'Dry', tone: 'yellow' as const, bar: 'bg-amber-500' };
  if (value > upper) return { label: 'Wet', tone: 'yellow' as const, bar: 'bg-sky-500' };
  return { label: 'Normal', tone: 'green' as const, bar: 'bg-emerald-500' };
}

function readingMoisture(ns: NodeSummary) {
  return ns.latest_reading?.soil_moisture ?? null;
}

export default function IrrigationPage() {
  const { id: farmId } = useParams();
  const { t } = useTranslation();
  const { data: summary, isLoading, error } = useFarmSummary(farmId ?? '');

  const stats = useMemo(() => {
    if (!summary) return null;
    const totalNodes = summary.nodes.length;
    const openValves = summary.nodes.filter((ns) => ns.decision?.valve_state === 'open').length;
    const closedValves = summary.nodes.filter((ns) => ns.decision?.valve_state === 'closed').length;
    const moistures = summary.nodes.map(readingMoisture).filter((v): v is number => v != null);
    const avgMoisture = moistures.length ? moistures.reduce((a, b) => a + b, 0) / moistures.length : null;
    const criticalDryNodes = summary.nodes.filter((ns) => {
      const moisture = readingMoisture(ns);
      return moisture != null && moisture < summary.thresholds.lower;
    }).length;
    const driestNodes = [...summary.nodes]
      .filter((ns) => readingMoisture(ns) != null)
      .sort((a, b) => (readingMoisture(a) ?? 0) - (readingMoisture(b) ?? 0))
      .slice(0, 3);
    return { totalNodes, openValves, closedValves, avgMoisture, criticalDryNodes, driestNodes };
  }, [summary]);

  if (isLoading) {
    return (
    <div className="space-y-4 min-h-screen">
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-lg" />)}
          </div>
          <Skeleton className="h-44 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !summary || !stats) {
    return (
      <FarmSummaryError message={error ? t('irrigation.errorLoad', { message: error.message }) : t('irrigation.noData')} />
    );
  }

  const lastSync = getFarmLastUpdate(summary.farm, summary.nodes);
  const gatewayTone = summary.gateway_status === 'online' ? 'green' : 'red';
  const modeLabel = stats.openValves > 0 ? 'Irigasi aktif' : 'Mode pantau';

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-2.5">
            <Waves className="mt-0.5 size-4 text-emerald-500" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Irrigation</h1>
              <p className="text-xs text-muted-foreground">Pantau kelembapan, keputusan irigasi, dan status valve semua node.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs lg:flex lg:items-center lg:gap-3">
            <MetaPill label="Mode" value={modeLabel} />
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1">
              <span className="text-muted-foreground">Gateway</span>
              <StatusPill tone={gatewayTone} label={summary.gateway_status} />
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-2 py-1">
              <span className="text-muted-foreground">Sync </span>
              <span className="font-medium text-foreground">{formatSyncTime(lastSync)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Total nodes" value={stats.totalNodes} icon={<Radio className="size-3.5" />} />
        <SummaryCard label="Open valves" value={stats.openValves} icon={<Waves className="size-3.5" />} tone="text-emerald-500" />
        <SummaryCard label="Closed valves" value={stats.closedValves} icon={<Waves className="size-3.5" />} tone="text-amber-500" />
        <SummaryCard label="Avg moisture" value={stats.avgMoisture == null ? '—' : `${stats.avgMoisture.toFixed(0)}%`} icon={<Droplets className="size-3.5" />} />
        <SummaryCard label="Critical dry" value={stats.criticalDryNodes} icon={<Gauge className="size-3.5" />} tone="text-red-500" />
      </div>

      <div className="grid min-h-[calc(100vh-335px)] items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
        <Card className="flex h-full flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('irrigation.perNodeTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 p-4 sm:p-5">
            {summary.nodes.length === 0 ? (
              <div className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                {t('irrigation.perNodeEmpty')}
              </div>
            ) : (
              <div className="grid flex-1 content-between gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
                {summary.nodes.map((ns) => <NodeCard key={ns.node.id} ns={ns} lower={summary.thresholds.lower} upper={summary.thresholds.upper} />)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rekomendasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
            {summary.nodes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada node untuk dianalisis.</p>
            ) : (
              stats.driestNodes.map((ns) => {
                const moisture = readingMoisture(ns);
                const condition = moistureCondition(moisture, summary.thresholds.lower, summary.thresholds.upper);
                const valveBadge = ns.decision ? getValveStatusBadge(valveKeyFromDecision(ns.decision)) : null;
                return (
                  <div key={ns.node.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-foreground">{ns.node.name || ns.node.id}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{moisture ?? '—'}% · {condition.label}</div>
                    </div>
                    {valveBadge ? <StatusPill tone={valveBadge.tone} label={t(valveBadge.labelKey)} /> : <StatusPill tone="neutral" label="—" />}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2 py-1">
      <span className="text-muted-foreground">{label} </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function SummaryCard({ label, value, icon, tone = 'text-muted-foreground' }: { label: string; value: string | number; icon: React.ReactNode; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider ${tone}`}>{icon}{label}</div>
        <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

function NodeCard({ ns, lower, upper }: { ns: NodeSummary; lower: number; upper: number }) {
  const { t } = useTranslation();
  const reading = ns.latest_reading;
  const moisture = reading?.soil_moisture ?? null;
  const condition = moistureCondition(moisture, lower, upper);
  const irrBadge = ns.decision ? getIrrigationStatusBadge(ns.decision.decision) : null;
  const valveBadge = ns.decision ? getValveStatusBadge(valveKeyFromDecision(ns.decision)) : null;
  const progress = moisture == null ? 0 : Math.max(0, Math.min(100, moisture));

  return (
      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[0.95rem] font-medium text-foreground">{ns.node.name || ns.node.id}</div>
          <div className="truncate text-xs text-muted-foreground">{ns.node.location || '—'}</div>
        </div>
        {valveBadge ? <StatusPill tone={valveBadge.tone} label={t(valveBadge.labelKey)} /> : <StatusPill tone="neutral" label={t('irrigation.waitingData')} />}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums text-foreground">{moisture == null ? '—' : `${moisture}%`}</span>
          <StatusPill tone={condition.tone} label={condition.label} />
        </div>
        {irrBadge ? <StatusPill tone={irrBadge.tone} label={t(irrBadge.labelKey)} /> : <StatusPill tone="neutral" label="—" />}
      </div>

      <div className="mt-2 space-y-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${condition.bar}`} style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0%</span><span>{`${lower}–${upper}%`}</span><span>100%</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span><Timer className="mr-1 inline size-3" aria-hidden="true" />{formatSyncTime(reading?.created_at ?? ns.node.updated_at)}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="h-8 px-2 text-xs">Detail</Button>
        <Button variant="outline" size="sm" className="h-8 px-2 text-xs">Manual</Button>
      </div>
    </div>
  );
}
