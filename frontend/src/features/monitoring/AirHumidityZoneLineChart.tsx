import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Droplets } from 'lucide-react';
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { StatusPill } from '@/components/ui/status-pill';
import type { StatusTone } from '@/lib/status';
import type { Reading } from '@/types';
import { latestValue, formatTimeLabel, normalizeReadings } from './chart-helpers';

const PALETTE = { main: '#8B5CF6', dark: '#7C3AED', light: '#A78BFA', wet: '#3B82F6', dry: '#F97316' };
const RANGE = { min: 60, max: 85 };
const CHART_MAX = 100;

function humidityStatus(value: number): { labelKey: string; tone: StatusTone } {
  if (value < RANGE.min) return { labelKey: 'monitoring.humidityStatus.dry', tone: 'yellow' };
  if (value > RANGE.max) return { labelKey: 'monitoring.humidityStatus.wet', tone: 'green' };
  return { labelKey: 'monitoring.humidityStatus.normal', tone: 'green' };
}

interface Point {
  label: string;
  value: number;
}

export default function AirHumidityZoneLineChart({ readings }: { readings: Reading[] }) {
  const { t } = useTranslation();

  const points = useMemo<Point[]>(() => {
    const asc = normalizeReadings(readings);
    const step = Math.max(1, Math.floor(asc.length / 30));
    return asc.filter((_, i) => i % step === 0).map((r) => ({
      label: formatTimeLabel(r.created_at),
      value: Number(r.air_humidity),
    }));
  }, [readings]);

  const latestHumidity = latestValue(readings, 'air_humidity');
  const config = { hum: { label: `${t('monitoring.chartAirHumidity')} %`, color: PALETTE.main } } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('monitoring.chartAirHumidity')}
            </CardTitle>
            {latestHumidity != null && (() => {
              const s = humidityStatus(latestHumidity);
              return (
                <div className="mt-1 flex items-baseline gap-2">
                  <Droplets className="size-4 text-violet-500 dark:text-violet-400" aria-hidden="true" />
                  <span className="text-3xl font-bold tabular-nums text-foreground">{latestHumidity.toFixed(0)}%</span>
                  <StatusPill tone={s.tone} label={t(s.labelKey)} />
                </div>
              );
            })()}
          </div>
          <div className="text-right text-[0.65rem] text-muted-foreground">
            <div>{t('monitoring.zoneIdeal')}</div>
            <div className="text-sm font-semibold tabular-nums text-foreground">
              {RANGE.min}–{RANGE.max}%
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[280px] w-full">
          <ComposedChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />
            <ReferenceArea y1={0} y2={RANGE.min} fill={PALETTE.dry} fillOpacity={0.05} />
            <ReferenceArea y1={RANGE.min} y2={RANGE.max} fill={PALETTE.main} fillOpacity={0.07} />
            <ReferenceArea y1={RANGE.max} y2={CHART_MAX} fill={PALETTE.wet} fillOpacity={0.05} />
            <ReferenceLine y={RANGE.min} stroke={PALETTE.dry} strokeOpacity={0.45} strokeDasharray="5 3" />
            <ReferenceLine y={RANGE.max} stroke={PALETTE.wet} strokeOpacity={0.45} strokeDasharray="5 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} />
            <YAxis domain={[0, CHART_MAX]} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} />
            <ChartTooltip content={<ChartTooltipContent formatter={(v: unknown) => [`${Number(v ?? 0).toFixed(0)}%`, t('monitoring.chartAirHumidity')]} />} />
            <Line
              dataKey="value"
              type="monotone"
              stroke={PALETTE.main}
              strokeWidth={2.5}
              dot={(props: { cx?: number; cy?: number }) => {
                const { cx, cy } = props;
                if (cx == null || cy == null) return null;
                return <circle cx={cx} cy={cy} r={3.5} fill={PALETTE.main} stroke="#fff" strokeWidth={1} />;
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
