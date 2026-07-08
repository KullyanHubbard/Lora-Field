import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ThermometerSun } from 'lucide-react';
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { StatusTone } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { Reading } from '@/types';
import { DEG_C } from '@/lib/format';
import { latestValue, getHourlyMonitoringPoints } from '../chartHelpers';
import { MonitoringChartHeader } from './MonitoringChartHeader';
import { MONITORING_LINE_ANIMATION } from './monitoringChartAnimation';

const PALETTE = { main: '#F59E0B', cool: '#06B6D4', hot: '#EF4444' };
const COMFORT = { min: 24, max: 32 };
const CHART_MAX = 40;

function airTempStatus(value: number): { labelKey: string; tone: StatusTone } {
  if (value < COMFORT.min) return { labelKey: 'monitoring.airStatus.cool', tone: 'green' };
  if (value > COMFORT.max) return { labelKey: 'monitoring.airStatus.hot', tone: 'red' };
  return { labelKey: 'monitoring.airStatus.normal', tone: 'green' };
}

interface Point {
  label: string;
  value: number;
  band: 'cool' | 'ideal' | 'hot';
}

function classifyBand(value: number): Point['band'] {
  if (value < COMFORT.min) return 'cool';
  if (value > COMFORT.max) return 'hot';
  return 'ideal';
}

export default function AirTempZoneLineChart({
  readings,
  embedded = false,
}: {
  readings: Reading[];
  embedded?: boolean;
}) {
  const { t } = useTranslation();

  const points = useMemo<Point[]>(() => {
    return getHourlyMonitoringPoints(readings).map(({ label, reading }) => ({
      label,
      value: reading.air_temp,
      band: classifyBand(reading.air_temp),
    }));
  }, [readings]);

  const latestAvg = latestValue(readings, 'air_temp');
  const latestStatus = latestAvg != null ? airTempStatus(latestAvg) : null;
  const config = { value: { label: `${t('monitoring.chartAirTemp')} ${DEG_C}`, color: PALETTE.main } } satisfies ChartConfig;

  return (
    <Card
      className={cn(
        embedded && 'h-full min-h-0 rounded-md bg-transparent py-3 ring-0 [--card-spacing:--spacing(3)]',
      )}
    >
      <MonitoringChartHeader
        title={t('monitoring.chartAirTemp')}
        icon={<ThermometerSun className="size-4 text-red-500 dark:text-red-400" aria-hidden="true" />}
        value={latestAvg != null ? latestAvg.toFixed(1) : null}
        unit={DEG_C}
        status={latestStatus ? { tone: latestStatus.tone, label: t(latestStatus.labelKey) } : undefined}
        sideLabel={t('monitoring.zoneTemp')}
        sideValue={`${COMFORT.min}–${COMFORT.max}${DEG_C}`}
        embedded={embedded}
      />
      <CardContent className={cn(embedded && 'min-h-0 flex-1')}>
        <ChartContainer config={config} className={cn('w-full', embedded ? 'h-full aspect-auto' : 'h-[280px]')}>
          <ComposedChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />
            <ReferenceArea y1={0} y2={COMFORT.min} fill={PALETTE.cool} fillOpacity={0.05} />
            <ReferenceArea y1={COMFORT.min} y2={COMFORT.max} fill="#10B981" fillOpacity={0.07} />
            <ReferenceArea y1={COMFORT.max} y2={CHART_MAX} fill={PALETTE.hot} fillOpacity={0.05} />
            <ReferenceLine y={COMFORT.min} stroke={PALETTE.cool} strokeOpacity={0.45} strokeDasharray="5 3" />
            <ReferenceLine y={COMFORT.max} stroke={PALETTE.hot} strokeOpacity={0.45} strokeDasharray="5 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} />
            <YAxis domain={[0, CHART_MAX]} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v}${DEG_C}`} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} />
            <ChartTooltip content={<ChartTooltipContent formatter={(v: unknown) => [`${Number(v ?? 0).toFixed(1)}${DEG_C}`, t('monitoring.chartAirTemp')]} />} />
            <Line
              dataKey="value"
              type="monotone"
              stroke={PALETTE.main}
              strokeWidth={2.5}
              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                const { cx, cy, index } = props;
                if (cx == null || cy == null || index == null) return null;
                const pt = points[index];
                const fill = pt?.band === 'cool' ? PALETTE.cool : pt?.band === 'hot' ? PALETTE.hot : PALETTE.main;
                return (
                  <rect
                    x={cx - 3.25}
                    y={cy - 3.25}
                    width={6.5}
                    height={6.5}
                    rx={1.5}
                    fill={fill}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                );
              }}
              activeDot={{ r: 5, fill: PALETTE.main, stroke: '#fff', strokeWidth: 1.5 }}
              {...MONITORING_LINE_ANIMATION}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
