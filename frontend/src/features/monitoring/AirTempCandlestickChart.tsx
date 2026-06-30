import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ThermometerSun } from 'lucide-react';
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { StatusPill } from '@/components/ui/status-pill';
import type { StatusTone } from '@/lib/status';
import type { Reading } from '@/types';
import { DEG_C } from '@/lib/format';
import { latestValue, type ChunkAggregate, groupByKey } from './chart-helpers';

const PALETTE = { main: '#F59E0B', cool: '#06B6D4', hot: '#EF4444' };
const COMFORT = { min: 24, max: 32 };
const CHART_MAX = 40;

function airTempStatus(value: number): { labelKey: string; tone: StatusTone } {
  if (value < COMFORT.min) return { labelKey: 'monitoring.airStatus.cool', tone: 'green' };
  if (value > COMFORT.max) return { labelKey: 'monitoring.airStatus.hot', tone: 'red' };
  return { labelKey: 'monitoring.airStatus.normal', tone: 'green' };
}

interface Point extends ChunkAggregate {
  band: 'cool' | 'ideal' | 'hot';
}

function classifyBand(value: number): Point['band'] {
  if (value < COMFORT.min) return 'cool';
  if (value > COMFORT.max) return 'hot';
  return 'ideal';
}

export default function AirTempCandlestickChart({ readings }: { readings: Reading[] }) {
  const { t } = useTranslation();

  const points = useMemo<Point[]>(() => {
    const asc = [...readings].reverse();
    const chunkSize = Math.max(2, Math.ceil(asc.length / 30));
    return groupByKey(asc, 'air_temp', chunkSize, (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      return Number.isFinite(d.getTime()) ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
    }).map((a) => ({ ...a, band: classifyBand(a.avg) }));
  }, [readings]);

  const latestAvg = latestValue(readings, 'air_temp');
  const config = { avg: { label: `${t('monitoring.chartAirTemp')} ${DEG_C}`, color: PALETTE.main } } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('monitoring.chartAirTemp')}
            </CardTitle>
            {latestAvg != null && (() => {
              const s = airTempStatus(latestAvg);
              return (
                <div className="mt-1 flex items-baseline gap-2">
                  <ThermometerSun className="size-4 text-red-500 dark:text-red-400" aria-hidden="true" />
                  <span className="text-3xl font-bold tabular-nums text-foreground">{latestAvg.toFixed(1)}</span>
                  <span className="text-base text-muted-foreground">{DEG_C}</span>
                  <StatusPill tone={s.tone} label={t(s.labelKey)} />
                </div>
              );
            })()}
          </div>
          <div className="text-right text-[0.65rem] text-muted-foreground">
            <div>{t('monitoring.zoneTemp')}</div>
            <div className="text-sm font-semibold tabular-nums text-foreground">
              {COMFORT.min}–{COMFORT.max}{DEG_C}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[280px] w-full">
          <ComposedChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />
            <ReferenceArea y1={0} y2={COMFORT.min} fill={PALETTE.cool} fillOpacity={0.05} />
            <ReferenceArea y1={COMFORT.min} y2={COMFORT.max} fill="#10B981" fillOpacity={0.07} />
            <ReferenceArea y1={COMFORT.max} y2={CHART_MAX} fill={PALETTE.hot} fillOpacity={0.05} />
            <ReferenceLine y={COMFORT.min} stroke={PALETTE.cool} strokeOpacity={0.45} strokeDasharray="5 3" />
            <ReferenceLine y={COMFORT.max} stroke={PALETTE.hot} strokeOpacity={0.45} strokeDasharray="5 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} />
            <YAxis domain={[0, CHART_MAX]} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v}${DEG_C}`} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} />
            <ChartTooltip content={<ChartTooltipContent formatter={(v: unknown) => [`${Number(v ?? 0).toFixed(1)}${DEG_C}`, t('monitoring.chartAirTemp')]} />} />
            <Line
              dataKey="avg"
              type="monotone"
              stroke={PALETTE.main}
              strokeWidth={2.5}
              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                const { cx, cy, index } = props;
                if (cx == null || cy == null || index == null) return null;
                const pt = points[index];
                const fill = pt?.band === 'cool' ? PALETTE.cool : pt?.band === 'hot' ? PALETTE.hot : PALETTE.main;
                return <circle cx={cx} cy={cy} r={3.5} fill={fill} stroke="#fff" strokeWidth={1} />;
              }}
              activeDot={{ r: 4.5 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
