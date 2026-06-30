import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, XAxis, YAxis } from 'recharts';
import {
  Activity,
    ArrowDown,
    ArrowUp,
    BatteryFull,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudLightning,
  CloudOff,
  CloudRain,
  CloudRainWind,
  CloudSun,
  Cpu,
  Droplet,
  Droplets,
    Minus,
        Sun,
  Thermometer,
    TriangleAlert,
  Zap,
} from 'lucide-react';
import { useFarmSummary } from './queries';
import { batteryTone, getNodeStatusBadge } from '@/lib/status';
import { StatusPill } from '@/components/ui/status-pill';
import { MOCK_GATEWAY_LOGS } from '@/lib/mockFarmData';
import { cn } from '@/lib/utils';
import { GaugeRing } from '@/components/ui/gauge-ring';
import type { GaugeTone } from '@/components/ui/gauge-ring';
import { DEG_C, timeAgo } from '@/lib/format';
import {
  getWeatherCodeInfo,
  pickNumber,
  type WeatherIconKey,
} from '@/features/weather/weatherHelpers';
import { GatewayInfoContent } from '@/features/gateway/components/GatewayInfoContent';
import { FarmSummaryError } from '@/components/FarmSummaryError';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { historicalData, type ChartPoint } from '@/lib/historicalData';
import type { FarmSummary, NodeSummary, WeatherForecastPoint } from '@/types';

const DASH = '—';
const BATTERY_VISIBLE_COUNT = 4;
const BATTERY_GAP = 16;
const BATTERY_TOTAL_GAP = BATTERY_GAP * (BATTERY_VISIBLE_COUNT - 1);
// Lebar minimum tiap gauge agar tidak tumpang tindih saat kartu menyempit
// (kolom kanan baris 2). Di kartu lebar tetap maks 4 terlihat; di kartu sempit
// gauge mempertahankan ukuran & scroller mengambil alih.
const BATTERY_MIN_ITEM = 144;

function toFiniteNumber(value: number | null | undefined): number | null {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatRounded(value: number | null | undefined, suffix = ''): string {
  const numeric = toFiniteNumber(value);
  return numeric == null ? DASH : `${Math.round(numeric)}${suffix}`;
}

function formatPercent(value: number | null | undefined): string {
  const numeric = toFiniteNumber(value);
  return numeric == null ? DASH : `${clampPercent(numeric)}%`;
}

const weatherIcon: Record<WeatherIconKey, typeof Sun> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  'cloud-showers': CloudRainWind,
  'cloud-bolt': CloudLightning,
  unknown: CloudOff,
};

function ValveStatCard({ summary, className }: { summary: FarmSummary; className?: string }) {
  const totalCount = summary.nodes.length;

  // Setiap bar mewakili satu node. Warna mengikuti aturan prioritas:
  // offline → MERAH, online + valve terbuka → HIJAU, online + valve tertutup → KUNING.
  const bars = summary.nodes.map((ns) => {
    if (ns.node.status === 'offline') return 'bg-red-500';
    return ns.decision?.valve_state === 'open' ? 'bg-emerald-500' : 'bg-amber-500';
  });

  const openCount = bars.filter((c) => c === 'bg-emerald-500').length;
  const offlineCount = bars.filter((c) => c === 'bg-red-500').length;
  const closedCount = totalCount - openCount - offlineCount;

  return (
    <div className={cn('flex flex-col rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex items-center gap-2">
        <Droplet className="size-4 shrink-0 text-cyan-500 dark:text-cyan-400" />
        <span className="text-sm font-medium text-foreground">Status Valve</span>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">Otomatis</span>
        <Zap className="size-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
      </div>

      {/* Mini bar — tiap segmen = satu node */}
      <div className="mt-3 space-y-2.5">
        {totalCount > 0 ? (
          <div className="flex gap-1" aria-hidden="true">
            {bars.map((color, i) => (
              <span
                key={i}
                className={cn('h-2 flex-1 rounded-full transition-opacity hover:opacity-80', color)}
              />
            ))}
          </div>
        ) : (
          <div className="h-2 w-full rounded-full bg-muted" aria-hidden="true" />
        )}

        {totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                <span className="tabular-nums text-foreground">{openCount}</span>
                <span className="text-muted-foreground">buka</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-amber-500" />
                <span className="tabular-nums text-foreground">{closedCount}</span>
                <span className="text-muted-foreground">tutup</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-red-500" />
                <span className="tabular-nums text-foreground">{offlineCount}</span>
                <span className="text-muted-foreground">offline</span>
              </span>
            </div>
            <span className="tabular-nums text-muted-foreground">
              {openCount}/{totalCount} terbuka
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ponytail: satu MetricStatCard — 4 instance di baris 3, masing-masing metrik berbeda.
// Tampilkan min/avg/maks dari array data historis (bukan grafik AreaChart).
function calcMinMaxAvg(values: number[]): { min: number; max: number; avg: number } | null {
  if (values.length === 0) return null;
  let min = Infinity, max = -Infinity, sum = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  if (!Number.isFinite(min)) return null;
  return { min, max, avg: sum / values.length };
}

function MetricStatCard({
  title,
  icon: Icon,
  iconColor,
  chartColor,
  dataKey,
  data,
  unit,
  decimals,
  nodes,
  className,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  // Warna garis/area grafik = warna ikon kartu (vivid), per tema light/dark.
  chartColor: { light: string; dark: string };
  dataKey: keyof ChartPoint;
  data: Record<string, ChartPoint[]>;
  unit: string;
  decimals: number;
  nodes: NodeSummary[];
  className?: string;
}) {
  const [selected, setSelected] = useState<string>('');
  const validId = nodes.length === 0 ? '' : selected && nodes.some((n) => n.node.id === selected) ? selected : nodes[0]?.node.id ?? '';
  const points = data[validId] ?? [];
  const values = points.map((p) => p[dataKey] as number).filter((v) => Number.isFinite(v));
  const stats = calcMinMaxAvg(values);
  const fmt = (v: number) => v.toFixed(decimals);

  // Grafik historis kompak (DATA DUMMY) — 6 titik jarak 1 jam, sumber sama dgn tile.
  const chartConfig = { value: { label: title, theme: chartColor } } satisfies ChartConfig;
  const chartData = points.map((p) => ({ label: p.label, value: Number(p[dataKey]) }));
  const gradId = `metric-grad-${useId().replace(/:/g, '')}`;

  return (
    <div className={cn('flex h-full flex-col rounded-xl border border-border bg-card p-4', className)}>
      {/* Header — judul + ikon kiri, dropdown node sejajar di kanan (hemat tinggi) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className={cn('size-5 shrink-0', iconColor)} aria-hidden="true" />
          <span className="truncate">{title}</span>
        </div>
        {nodes.length > 1 && (
          <select
            value={validId}
            onChange={(e) => setSelected(e.target.value)}
            className="min-w-0 max-w-[45%] shrink-0 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {nodes.map((ns) => (
              <option key={ns.node.id} value={ns.node.id}>
                {ns.node.name || ns.node.id}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Body — baris tile Min/Rata-rata/Maks, lalu grafik historis kompak di bawahnya */}
      {!stats ? (
        <p className="mt-4 flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">Tidak ada data</p>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-border bg-muted/30 px-2 py-1.5">
              <ArrowDown className="size-3.5 shrink-0 text-blue-500 dark:text-blue-400" aria-hidden="true" />
              <span className="mt-1 text-[0.58rem] font-semibold uppercase tracking-wider text-muted-foreground">Minimal</span>
              <span className="mt-0.5 text-base font-extrabold tabular-nums tracking-tight text-foreground">
                {fmt(stats.min)}{unit}
              </span>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-border bg-muted/30 px-2 py-1.5">
              <Minus className="size-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
              <span className="mt-1 text-[0.58rem] font-semibold uppercase tracking-wider text-muted-foreground">Rata-rata</span>
              <span className="mt-0.5 text-base font-extrabold tabular-nums tracking-tight text-foreground">
                {fmt(stats.avg)}{unit}
              </span>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-border bg-muted/30 px-2 py-1.5">
              <ArrowUp className="size-3.5 shrink-0 text-red-500 dark:text-red-400" aria-hidden="true" />
              <span className="mt-1 text-[0.58rem] font-semibold uppercase tracking-wider text-muted-foreground">Maksimal</span>
              <span className="mt-0.5 text-base font-extrabold tabular-nums tracking-tight text-foreground">
                {fmt(stats.max)}{unit}
              </span>
            </div>
          </div>

          {/* Grafik historis 6 jam (DATA DUMMY) — area kompak, warna mengikuti ikon kartu */}
          <div className="mt-2 flex min-h-[64px] flex-1 flex-col">
            <span className="mb-0.5 text-[0.58rem] font-medium uppercase tracking-wider text-muted-foreground">
              6 jam terakhir
            </span>
            <ChartContainer config={chartConfig} className="h-full min-h-0 w-full">
              <AreaChart data={chartData} margin={{ left: 4, right: 6, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  interval={0}
                  tick={{ fontSize: 9 }}
                />
                <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      formatter={(value) => (
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {Number(value).toFixed(decimals)}
                          {unit}
                        </span>
                      )}
                    />
                  }
                />
                <Area
                  dataKey="value"
                  type="monotone"
                  stroke="var(--color-value)"
                  strokeWidth={2}
                  fill={`url(#${gradId})`}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </>
      )}
    </div>
  );
}

// Glow lembut di belakang GaugeRing — pakai palet tone baterai yg sama (emerald/amber/red).
const batteryGlowClass: Record<GaugeTone, string> = {
  green: 'bg-emerald-500/15 dark:bg-emerald-400/12',
  yellow: 'bg-amber-500/15 dark:bg-amber-400/12',
  red: 'bg-red-500/15 dark:bg-red-400/12',
  neutral: '',
};

function BatteryNodesCard({ nodes, className }: { nodes: NodeSummary[]; className?: string }) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Trigger gauge animation when the card scrolls into the viewport.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setHasAnimated(true);
      return;
    }
    const el = scrollRef.current?.closest('.battery-section-root') as HTMLElement | null;
    if (!el) {
      setHasAnimated(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasAnimated(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    const scrollLeft = Math.min(Math.max(el.scrollLeft, 0), maxScrollLeft);
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft < maxScrollLeft - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const frame = window.requestAnimationFrame(updateScrollState);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollState) : null;
    ro?.observe(el);
    return () => {
      window.cancelAnimationFrame(frame);
      el.removeEventListener('scroll', updateScrollState);
      ro?.disconnect();
    };
  }, [updateScrollState, nodes.length]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el || el.clientWidth <= 0) return;
    el.scrollBy({ left: dir === 'left' ? -el.clientWidth : el.clientWidth, behavior: 'smooth' });
  };

  const showArrows = canScrollLeft || canScrollRight;
  const itemFlex = `0 0 calc((100% - ${BATTERY_TOTAL_GAP}px) / ${BATTERY_VISIBLE_COUNT})`;

  return (
    <Card className={cn('battery-section-root', className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <BatteryFull className="size-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
          {t('farmDetail.gaugeBatteryCardTitle')}
        </CardTitle>
        {showArrows && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('farmDetail.gaugeBatteryScrollLeft')}
              disabled={!canScrollLeft}
              onClick={() => scroll('left')}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('farmDetail.gaugeBatteryScrollRight')}
              disabled={!canScrollRight}
              onClick={() => scroll('right')}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {nodes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t('farmDetail.gaugeBatteryEmpty')}
          </p>
        ) : (
          <div
            ref={scrollRef}
            className={cn(
              'flex pb-2',
              nodes.length === 1
                ? 'justify-center'
                : 'snap-x snap-mandatory overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden',
            )}
            style={{ gap: BATTERY_GAP, scrollbarWidth: nodes.length === 1 ? 'auto' : 'none' }}
          >
            {nodes.map((ns) => {
              const value = toFiniteNumber(ns.node.battery);
              const pct = value != null ? clampPercent(value) : null;
              const tone: GaugeTone = pct != null ? (batteryTone(pct) as GaugeTone) : 'neutral';
              const centerSub =
                pct == null
                  ? undefined
                  : pct < 20
                    ? t('farmDetail.batteryLow')
                    : pct <= 50
                      ? t('farmDetail.batteryMid')
                      : t('farmDetail.batteryOk');
              return (
                <div
                  key={ns.node.id}
                  className="relative isolate flex shrink-0 snap-start justify-center"
                  style={{ flex: itemFlex, minWidth: BATTERY_MIN_ITEM }}
                >
                  {/* Glow se-tone di belakang ring: warnai ruang kosong, bukan border. Palet sama dgn arc gauge. */}
                  {tone !== 'neutral' && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'pointer-events-none absolute left-1/2 top-10 -z-10 size-16 -translate-x-1/2 rounded-full blur-2xl',
                        batteryGlowClass[tone],
                      )}
                    />
                  )}
                  <GaugeRing
                    value={pct}
                    centerLabel={pct != null ? `${pct}%` : DASH}
                    centerSub={centerSub}
                    tone={tone}
                    caption={ns.node.name || ns.node.location || ns.node.id}
                    animate={hasAnimated}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function mockRssi(nodeId: string) {
  if (!nodeId) return `${DASH} dBm`;
  const seed = Array.from(nodeId).reduce((a, c) => a + c.charCodeAt(0), 0);
  const val = -80 - (seed % 25);
  return `${val} dBm`;
}

// Ringkasan node sensor — dropdown selector, satu node per waktu. Pola sama
// dengan SoilMoistureCard: pilih node via dropdown, metrik dalam subcard grid.
function NodeSensorCard({ nodes, className }: { nodes: NodeSummary[]; className?: string }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);

  const selectedNs = nodes.find((ns) => ns.node.id === selected) ?? nodes[0] ?? null;
  const reading = selectedNs?.latest_reading ?? null;
  const badge = selectedNs ? getNodeStatusBadge(selectedNs.node.status) : null;

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="size-4 shrink-0 text-violet-500 dark:text-violet-400" />
            {t('nodes.title', 'Node Sensor')}
          </CardTitle>
          {selectedNs && (
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">{mockRssi(selectedNs.node.id)}</span>
              {badge && <StatusPill tone={badge.tone} label={t(badge.labelKey)} />}
            </div>
          )}
          {!selectedNs && badge && <StatusPill tone={badge.tone} label={t(badge.labelKey)} />}
        </div>
        {nodes.length > 1 && (
          <select
            value={selected ?? nodes[0]?.node.id ?? ''}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {nodes.map((ns) => (
              <option key={ns.node.id} value={ns.node.id}>
                {ns.node.name || ns.node.location || ns.node.id}
              </option>
            ))}
          </select>
        )}
        {nodes.length <= 1 && selectedNs && (
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedNs.node.name || selectedNs.node.location || selectedNs.node.id}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center">
        {!selectedNs ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('nodes.empty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-gradient-to-b from-muted/50 to-transparent px-3 py-2.5">
              <Droplets className="size-4 shrink-0 text-cyan-500 dark:text-cyan-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">{t('nodes.colSoilMoisture')}</p>
                <p className="text-base font-semibold tabular-nums tracking-tight text-foreground">{reading ? `${reading.soil_moisture}%` : DASH}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-gradient-to-b from-muted/50 to-transparent px-3 py-2.5">
              <Thermometer className="size-4 shrink-0 text-orange-500 dark:text-orange-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">{t('nodes.colSoilTemp')}</p>
                <p className="text-base font-semibold tabular-nums tracking-tight text-foreground">{reading ? `${reading.soil_temp}${DEG_C}` : DASH}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-gradient-to-b from-muted/50 to-transparent px-3 py-2.5">
              <Sun className="size-4 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">{t('nodes.colAirTemp')}</p>
                <p className="text-base font-semibold tabular-nums tracking-tight text-foreground">{reading ? `${reading.air_temp}${DEG_C}` : DASH}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-gradient-to-b from-muted/50 to-transparent px-3 py-2.5">
              <Cloud className="size-4 shrink-0 text-sky-500 dark:text-sky-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">{t('nodes.colAirHumidity')}</p>
                <p className="text-base font-semibold tabular-nums tracking-tight text-foreground">{reading ? `${reading.air_humidity}%` : DASH}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Format jam slot prakiraan jadi "HH.MM" (locale id) dari titik forecast BMKG.
function forecastSlotTime(point: WeatherForecastPoint, index: number): string {
  const raw = point.local_datetime || point.datetime || point.utc_datetime;
  if (!raw) return index === 0 ? '—' : `+${index * 3}j`;
  const normalized = String(raw).replace(' ', 'T');
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  const timePart = String(raw).split(/[ T]/)[1];
  return timePart ? timePart.slice(0, 5) : DASH;
}

function WeatherForecastCard({
  summary,
  farmId,
  className,
}: {
  summary: FarmSummary;
  farmId: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const weather = summary.weather;

  if (!weather) {
    return (
      <Card className={cn('flex h-full flex-col', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudOff className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
            {t('farmDetail.weatherForecastTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">{t('farmDetail.weatherUnavailable')}</p>
        </CardContent>
      </Card>
    );
  }

  const currentInfo = getWeatherCodeInfo(weather.code, weather.condition);
  const CurrentIcon = weatherIcon[currentInfo.iconKey];
  const rain = weather.rain_next_3h === true;

  const slots = (weather.forecast ?? []).slice(0, 6).map((point, i) => {
    const info = getWeatherCodeInfo(
      point.weather ?? point.code,
      point.weather_desc ?? point.condition,
    );
    const temp = pickNumber(point.t, point.temperature);
    return {
      key: i,
      time: forecastSlotTime(point, i),
      iconKey: info.iconKey,
      label: t(info.label),
      temp: temp != null ? `${Math.round(temp)}${DEG_C}` : DASH,
      isRain: info.isRain,
    };
  });

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CurrentIcon className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
          {t('farmDetail.weatherForecastTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {/* Verdict irigasi berdasar prediksi hujan 3 jam ke depan */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
          {rain ? (
            <TriangleAlert className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
          ) : (
            <Check className="size-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
          )}
          <span>
            {rain ? t('farmDetail.weatherVerdictDelay') : t('farmDetail.weatherVerdictSafe')}
          </span>
        </div>

        {/* Kondisi sekarang */}
        <div className="space-y-1 border-t border-border pt-4 text-sm">
          <p className="text-foreground">
            <span className="text-muted-foreground">{t('farmDetail.weatherNow')}: </span>
            {formatRounded(weather.temperature, DEG_C)} · {t(currentInfo.label)}
          </p>
          <p className="text-muted-foreground">
            {t('farmDetail.airHumidity')}: {formatPercent(weather.humidity)}
          </p>
        </div>

        {/* List prakiraan per slot waktu */}
        <div className="flex flex-1 flex-col gap-1 border-t border-border pt-4">
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('farmDetail.weatherNoForecast')}</p>
          ) : (
            slots.map((slot) => {
              const SlotIcon = weatherIcon[slot.iconKey];
              return (
                <div
                  key={slot.key}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-2 py-1.5 text-sm',
                    slot.isRain && 'bg-blue-500/10',
                  )}
                >
                  <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                    {slot.time}
                  </span>
                  <SlotIcon className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
                  <span className="w-10 shrink-0 font-medium tabular-nums text-foreground">
                    {slot.temp}
                  </span>
                  <span className="truncate text-muted-foreground">{slot.label}</span>
                </div>
              );
            })
          )}
        </div>

        <Link
          to={`/farms/${farmId}/weather`}
          className="mt-auto flex items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Selengkapnya
          <ChevronRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

function ActivityLogCard({ farmId, className }: { farmId: string; className?: string }) {
  const { t } = useTranslation();
  const logs = MOCK_GATEWAY_LOGS.slice(0, 2);

  const eventLabel: Record<string, string> = {
    connected: 'Terhubung',
    disconnected: 'Terputus',
    heartbeat: 'Heartbeat',
    data_sync: 'Sinkronisasi',
  };

  const eventDot: Record<string, string> = {
    connected: 'bg-emerald-500',
    disconnected: 'bg-red-500',
    heartbeat: 'bg-blue-500',
    data_sync: 'bg-violet-500',
  };

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4 shrink-0 text-violet-500 dark:text-violet-400" />
          Log Aktivitas
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {logs.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Belum ada aktivitas</p>
        ) : (
          <div className="flex-1 divide-y divide-border/40">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 py-1.5 first:pt-0 last:pb-0">
                <span
                  className={cn('mt-1.5 grid size-2 shrink-0 rounded-full', eventDot[log.event] ?? 'bg-muted-foreground')}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    {eventLabel[log.event] ?? log.event}
                  </p>
                  <p className="truncate text-[0.65rem] text-muted-foreground">{log.detail}</p>
                </div>
                <span className="shrink-0 pt-0.5 tabular-nums text-[0.65rem] text-muted-foreground">
                  {timeAgo(log.created_at, t)}
                </span>
              </div>
            ))}
          </div>
        )}
        <Link
          to={`/farms/${farmId}/gateway`}
          className="mt-auto flex items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Lihat Seluruh Log
          <ChevronRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

export default function FarmDetailPage() {
  const { id: farmId } = useParams();
  const { t } = useTranslation();
  const { data: summary, isLoading, error } = useFarmSummary(farmId ?? '');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(17rem,0.85fr)_minmax(0,2.15fr)]">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <FarmSummaryError
        message={
          error ? t('farmDetail.errorLoad', { message: error.message }) : t('farmDetail.noData2')
        }
      />
    );
  }

  const nodes = summary.nodes;
  const warning =
    summary.nodes_problem > 0
      ? t('farmDetail.nodesProblem', { count: summary.nodes_problem })
      : null;
  return (
    <div className="space-y-4">
      {warning && (
        <Card className="border-amber-500/20 bg-amber-500/10">
          <CardContent className="flex items-center gap-2 rounded-md text-sm font-medium text-amber-500 dark:text-amber-400">
            <TriangleAlert className="size-4 shrink-0" /> {warning}
          </CardContent>
        </Card>
      )}

      {/* Grid 5 kolom (xl). Baris 1: Status Valve + Gateway info + Log Aktivitas + Prediksi Cuaca.
          Prediksi Cuaca membentang turun ke baris 2, sejajar Kelembapan Tanah &
          Baterai Node. Baris 3: Status Node Sensor penuh. Penempatan xl pakai longhand
          col-start/col-end + row-start (override col-span-2 mobile dengan aman). Di
          bawah xl semua kartu menumpuk rapi. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {/* Baris 1 — Status Valve (1 kolom) */}
        <ValveStatCard
          summary={summary}
          className="sm:col-span-2 xl:col-start-1 xl:col-end-2 xl:row-start-1"
        />

        {/* Baris 1 — Gateway info (2 kolom) */}
        <div className="overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10 sm:col-span-2 xl:col-start-2 xl:col-end-4 xl:row-start-1">
          <GatewayInfoContent
            summary={summary}
            className="flex-1 p-4"
          />
        </div>

        {/* Baris 1 — Log Aktivitas (1 kolom, sejajar kanan Gateway) */}
        <ActivityLogCard
          farmId={farmId ?? ''}
          className="sm:col-span-2 xl:col-start-4 xl:col-end-5 xl:row-start-1"
        />


        {/* Prediksi Cuaca — 1 kolom (ke-5), membentang turun ke baris 2 */}
        <WeatherForecastCard
          summary={summary}
          farmId={farmId ?? ''}
          className="sm:col-span-2 xl:col-start-5 xl:col-end-6 xl:row-start-1 xl:row-span-2"
        />

        {/* Node Sensor — kolom kiri baris 2, sejajar Baterai Node */}
        <NodeSensorCard
          nodes={nodes}
          className="sm:col-span-2 xl:col-start-1 xl:col-end-2 xl:row-start-2"
        />

        {/* Baterai Node — baris 2, area tengah (3 kolom: slot 2-4) */}
        <BatteryNodesCard
          nodes={nodes}
          className="sm:col-span-2 xl:col-start-2 xl:col-end-5 xl:row-start-2"
        />

        {/* 4 Metric Stat Card — baris 3, full width (span 5 kolom), subgrid 4 kolom */}
        <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2 xl:col-start-1 xl:col-end-6 xl:row-start-3 xl:grid-cols-4">
          {(() => {
            const mockKeys = ['node-a', 'node-b', 'node-c', 'node-d'];
            const nodeDataMap: Record<string, ChartPoint[]> = {};
            nodes.forEach((ns, i) => {
              nodeDataMap[ns.node.id] = historicalData[mockKeys[i]] ?? historicalData['node-a'] ?? [];
            });
            const cards = [
              { title: t('farmDetail.soilMoistureTitle'), icon: Droplets, iconColor: 'text-cyan-500 dark:text-cyan-400', chartColor: { light: '#06b6d4', dark: '#22d3ee' }, dataKey: 'soil_moisture' as keyof ChartPoint, unit: '%', decimals: 0 },
              { title: t('nodes.colSoilTemp'), icon: Thermometer, iconColor: 'text-orange-500 dark:text-orange-400', chartColor: { light: '#f97316', dark: '#fb923c' }, dataKey: 'soil_temp' as keyof ChartPoint, unit: '°C', decimals: 1 },
              { title: t('nodes.colAirTemp'), icon: Sun, iconColor: 'text-amber-500 dark:text-amber-400', chartColor: { light: '#f59e0b', dark: '#fbbf24' }, dataKey: 'air_temp' as keyof ChartPoint, unit: '°C', decimals: 1 },
              { title: t('nodes.colAirHumidity'), icon: Cloud, iconColor: 'text-sky-500 dark:text-sky-400', chartColor: { light: '#0ea5e9', dark: '#38bdf8' }, dataKey: 'air_humidity' as keyof ChartPoint, unit: '%', decimals: 0 },
            ];
            return cards.map((c) => (
              <MetricStatCard
                key={c.dataKey}
                {...c}
                data={nodeDataMap}
                nodes={nodes}
              />
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
