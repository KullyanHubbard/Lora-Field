import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ThermometerSun } from 'lucide-react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { StatusTone } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { Reading } from '@/types';
import { DEG_C } from '@/lib/format';
import { latestValue, getHourlyMonitoringPoints } from '@/features/monitoring/chartHelpers';
import { MonitoringChartHeader } from './MonitoringChartHeader';
import { MONITORING_LINE_ANIMATION } from './monitoringChartAnimation';
import { CHART_COLORS } from '@/lib/chartColors';

const PALETTE = { main: CHART_COLORS.amber, cool: CHART_COLORS.cyan, hot: CHART_COLORS.red };
const OPTIMAL_SOIL_TEMP = { min: 18, max: 28 };
const CHART_MAX = 40;

function soilTempStatus(avg: number): { labelKey: string; tone: StatusTone } {
  if (avg < OPTIMAL_SOIL_TEMP.min)
    return { labelKey: 'monitoring.soilTempStatus.cold', tone: 'yellow' };
  if (avg > OPTIMAL_SOIL_TEMP.max)
    return { labelKey: 'monitoring.soilTempStatus.warm', tone: 'red' };
  return { labelKey: 'monitoring.soilTempStatus.normal', tone: 'green' };
}

interface Point {
  label: string;
  value: number;
  band: 'cold' | 'ideal' | 'hot';
}

function classifyBand(value: number): Point['band'] {
  if (value < OPTIMAL_SOIL_TEMP.min) return 'cold';
  if (value > OPTIMAL_SOIL_TEMP.max) return 'hot';
  return 'ideal';
}

export default function SoilTempZoneLineChart({
  readings,
  embedded = false,
}: {
  readings: Reading[];
  embedded?: boolean;
}) {
  const { t, i18n } = useTranslation();

  const points = useMemo<Point[]>(() => {
    return getHourlyMonitoringPoints(readings, i18n.language).map(({ label, reading }) => ({
      label,
      value: reading.soil_temp,
      band: classifyBand(reading.soil_temp),
    }));
  }, [readings, i18n.language]);

  const latestAvg = latestValue(readings, 'soil_temp');
  const latestStatus = latestAvg != null ? soilTempStatus(latestAvg) : null;

  const config = {
    value: { label: `${t('monitoring.chartSoilTemp')} ${DEG_C}`, color: PALETTE.main },
  } satisfies ChartConfig;

  return (
    <Card
      className={cn(
        embedded &&
          'h-full min-h-0 rounded-md bg-transparent py-3 ring-0 [--card-spacing:--spacing(3)]',
      )}
    >
      <MonitoringChartHeader
        title={t('monitoring.chartSoilTemp')}
        icon={
          <ThermometerSun
            className="size-4 text-amber-500 dark:text-amber-400"
            aria-hidden="true"
          />
        }
        value={latestAvg != null ? latestAvg.toFixed(1) : null}
        unit={DEG_C}
        status={
          latestStatus ? { tone: latestStatus.tone, label: t(latestStatus.labelKey) } : undefined
        }
        sideLabel={t('dashboard.soilTargetCaption', {
          lower: OPTIMAL_SOIL_TEMP.min,
          upper: OPTIMAL_SOIL_TEMP.max,
        })}
        sideValue={`${OPTIMAL_SOIL_TEMP.min}–${OPTIMAL_SOIL_TEMP.max}${DEG_C}`}
        embedded={embedded}
      />
      <CardContent className={cn(embedded && 'min-h-0 flex-1')}>
        <ChartContainer
          config={config}
          className={cn('w-full', embedded ? 'h-full aspect-auto' : 'h-[280px]')}
        >
          <ComposedChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="currentColor"
              strokeOpacity={0.12}
            />
            <ReferenceArea
              y1={0}
              y2={OPTIMAL_SOIL_TEMP.min}
              fill={PALETTE.cool}
              fillOpacity={0.05}
            />
            <ReferenceArea
              y1={OPTIMAL_SOIL_TEMP.min}
              y2={OPTIMAL_SOIL_TEMP.max}
              fill={CHART_COLORS.emerald}
              fillOpacity={0.07}
            />
            <ReferenceArea
              y1={OPTIMAL_SOIL_TEMP.max}
              y2={CHART_MAX}
              fill={PALETTE.hot}
              fillOpacity={0.05}
            />
            <ReferenceLine
              y={OPTIMAL_SOIL_TEMP.min}
              stroke={PALETTE.cool}
              strokeOpacity={0.45}
              strokeDasharray="5 3"
            />
            <ReferenceLine
              y={OPTIMAL_SOIL_TEMP.max}
              stroke={PALETTE.hot}
              strokeOpacity={0.45}
              strokeDasharray="5 3"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
            />
            <YAxis
              domain={[0, CHART_MAX]}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v) => `${v}${DEG_C}`}
              tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v: unknown) => [
                    `${Number(v ?? 0).toFixed(1)}${DEG_C}`,
                    t('monitoring.chartSoilTemp'),
                  ]}
                />
              }
            />
            <Line
              dataKey="value"
              type="monotone"
              stroke={PALETTE.main}
              strokeWidth={2.5}
              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                const { cx, cy, index } = props;
                if (cx == null || cy == null || index == null) return null;
                const pt = points[index];
                const fill =
                  pt?.band === 'cold'
                    ? PALETTE.cool
                    : pt?.band === 'hot'
                      ? PALETTE.hot
                      : PALETTE.main;
                return (
                  <rect
                    x={cx - 3.25}
                    y={cy - 3.25}
                    width={6.5}
                    height={6.5}
                    rx={1}
                    fill={fill}
                    stroke={CHART_COLORS.dotRing}
                    strokeWidth={1}
                    transform={`rotate(45 ${cx} ${cy})`}
                  />
                );
              }}
              activeDot={{
                r: 5,
                fill: PALETTE.main,
                stroke: CHART_COLORS.dotRing,
                strokeWidth: 1.5,
              }}
              {...MONITORING_LINE_ANIMATION}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
