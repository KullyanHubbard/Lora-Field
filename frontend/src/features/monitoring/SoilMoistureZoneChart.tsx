import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { Droplets, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/utils';
import type { Reading } from '@/types';
import { formatTimeLabel } from './chart-helpers';

// Konsisten dengan tema: cyan = garis utama, hijau = zona ideal,
// merah = batas, biru = zona basah.
const COLOR_LINE = '#06B6D4';
const COLOR_OK = '#10B981';
const COLOR_DRY = '#EF4444';
const COLOR_WET = '#3B82F6';

interface Point {
  label: string;
  value: number;
}

function classifyMoisture(value: number, lower: number, upper: number) {
  if (value < lower) return 'kering' as const;
  if (value > upper) return 'basah' as const;
  return 'cukup' as const;
}

const STATUS_TONE = {
  kering: 'red' as const,
  cukup: 'green' as const,
  basah: 'yellow' as const,
};

const STATUS_LABEL = {
  kering: 'Kering',
  cukup: 'Cukup',
  basah: 'Basah',
};

export default function SoilMoistureZoneChart({
  readings,
  lower,
  upper,
}: {
  readings: Reading[];
  lower: number;
  upper: number;
}) {
  const { t } = useTranslation();

  const points: Point[] = useMemo(
    () =>
      [...readings].reverse().map((r) => ({
        label: formatTimeLabel(r.created_at),
        value: r.soil_moisture,
      })),
    [readings],
  );

  const latest = points.length > 0 ? points[points.length - 1].value : null;
  const status = latest != null ? classifyMoisture(latest, lower, upper) : null;

  // Hitung durasi pelanggaran (>70 atau <40) untuk pesan yang informatif
  const overHigh = points.filter((p) => p.value > upper).length;
  const underLow = points.filter((p) => p.value < lower).length;

  const config = {
    soil: { label: t('monitoring.chartSoilMoisture'), color: COLOR_LINE },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('monitoring.chartSoilMoisture')}
            </CardTitle>
            {latest != null && (
              <div className="mt-1 flex items-baseline gap-2">
                <Droplets className="size-4 text-cyan-500 dark:text-cyan-400" aria-hidden="true" />
                <span className="text-3xl font-bold tabular-nums text-foreground">
                  {latest.toFixed(0)}%
                </span>
                {status && (
                  <StatusPill tone={STATUS_TONE[status]} label={STATUS_LABEL[status]} />
                )}
              </div>
            )}
          </div>
          <div className="text-right text-[0.65rem] text-muted-foreground">
            <div>Zona aman</div>
            <div className="text-sm font-semibold tabular-nums text-foreground">
              {lower}–{upper}%
            </div>
          </div>
        </div>

        {/* Banner status eksplisit */}
        {status === 'kering' && (
          <StatusBanner tone="danger">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            <span>Di bawah {lower}% — tanah kering{underLow > 0 ? ` (${underLow} dari ${points.length} titik)` : ''}.</span>
          </StatusBanner>
        )}
        {status === 'cukup' && (
          <StatusBanner tone="ok">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            <span>Di zona aman {lower}–{upper}% — kelembapan ideal.</span>
          </StatusBanner>
        )}
        {status === 'basah' && (
          <StatusBanner tone="warning">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            <span>Di atas {upper}% — tanah basah{overHigh > 0 ? ` (${overHigh} dari ${points.length} titik)` : ''}, tunda irigasi.</span>
          </StatusBanner>
        )}
      </CardHeader>

      <CardContent>
        <ChartContainer config={config} className="h-[280px] w-full">
          <ComposedChart data={points} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />

            {/* Zona basah (biru) — di atas upper, terlalu basah */}
            <ReferenceArea y1={upper} y2={100} fill={COLOR_WET} fillOpacity={0.12} />
            {/* Zona ideal (hijau) — antara lower dan upper */}
            <ReferenceArea y1={lower} y2={upper} fill={COLOR_OK} fillOpacity={0.12} />
            {/* Zona kering (merah) — di bawah lower */}
            <ReferenceArea y1={0} y2={lower} fill={COLOR_DRY} fillOpacity={0.07} />

            <ReferenceLine
              y={lower}
              stroke={COLOR_DRY}
              strokeOpacity={0.5}
              strokeDasharray="4 4"
              label={{
                value: `${lower}%`,
                position: 'insideBottomRight',
                fill: 'currentColor',
                fontSize: 10,
                opacity: 0.7,
              }}
            />
            <ReferenceLine
              y={upper}
              stroke={COLOR_DRY}
              strokeOpacity={0.5}
              strokeDasharray="4 4"
              label={{
                value: `${upper}%`,
                position: 'insideTopRight',
                fill: 'currentColor',
                fontSize: 10,
                opacity: 0.7,
              }}
            />

            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
            />

            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v: unknown) => [
                    `${Number(v ?? 0).toFixed(1)}%`,
                    t('monitoring.chartSoilMoisture'),
                  ]}
                />
              }
            />

            <Line
              dataKey="value"
              type="monotone"
              stroke={COLOR_LINE}
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: COLOR_LINE, stroke: '#fff', strokeWidth: 1 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function StatusBanner({
  tone,
  children,
}: {
  tone: 'ok' | 'warning' | 'danger';
  children: React.ReactNode;
}) {
  const toneClass = {
    ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    danger: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  }[tone];
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium',
        toneClass,
      )}
    >
      {children}
    </div>
  );
}