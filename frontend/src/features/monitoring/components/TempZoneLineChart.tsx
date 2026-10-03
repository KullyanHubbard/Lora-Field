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
import { ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import type { Reading } from '@/types';
import { DEG_C } from '@/lib/format';
import {
  getHourlyMonitoringPoints,
  latestValue,
  TEMP_CHART_MAX_C,
  tempBand,
  type TempBand,
  type TempZone,
} from '@/features/monitoring/chartHelpers';
import { MonitoringChartCard } from './MonitoringChartCard';
import { MonitoringChartHeader } from './MonitoringChartHeader';
import { MONITORING_LINE_ANIMATION } from './monitoringChartAnimation';
import { CHART_COLORS } from '@/lib/chartColors';

const PALETTE = { main: CHART_COLORS.amber, cool: CHART_COLORS.cyan, hot: CHART_COLORS.red };
const DOT_FILL: Record<TempBand, string> = {
  low: PALETTE.cool,
  ideal: PALETTE.main,
  high: PALETTE.hot,
};

interface Point {
  label: string;
  value: number;
  band: TempBand;
}

export default function TempZoneLineChart({
  zone,
  readings,
  embedded = false,
}: {
  zone: TempZone;
  readings: Reading[];
  embedded?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { metric, range } = zone;
  const title = t(zone.titleKey);

  const points = useMemo<Point[]>(() => {
    return getHourlyMonitoringPoints(readings, i18n.language).map(({ label, reading }) => ({
      label,
      value: reading[metric],
      band: tempBand(reading[metric], range),
    }));
  }, [readings, i18n.language, metric, range]);

  const latest = latestValue(readings, metric);
  const latestStatus = latest != null ? zone.status[tempBand(latest, range)] : null;
  const config = {
    value: { label: `${title} ${DEG_C}`, color: PALETTE.main },
  } satisfies ChartConfig;

  return (
    <MonitoringChartCard
      config={config}
      embedded={embedded}
      header={
        <MonitoringChartHeader
          title={title}
          icon={<ThermometerSun className={cn('size-4', zone.iconClass)} aria-hidden="true" />}
          value={latest != null ? latest.toFixed(1) : null}
          unit={DEG_C}
          status={
            latestStatus ? { tone: latestStatus.tone, label: t(latestStatus.labelKey) } : undefined
          }
          sideLabel={t('monitoring.zoneTemp')}
          sideValue={`${range.min}–${range.max}${DEG_C}`}
          embedded={embedded}
        />
      }
    >
      <ComposedChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 3"
          stroke="currentColor"
          strokeOpacity={0.12}
        />
        <ReferenceArea y1={0} y2={range.min} fill={PALETTE.cool} fillOpacity={0.05} />
        <ReferenceArea
          y1={range.min}
          y2={range.max}
          fill={CHART_COLORS.emerald}
          fillOpacity={0.07}
        />
        <ReferenceArea y1={range.max} y2={TEMP_CHART_MAX_C} fill={PALETTE.hot} fillOpacity={0.05} />
        <ReferenceLine
          y={range.min}
          stroke={PALETTE.cool}
          strokeOpacity={0.45}
          strokeDasharray="5 3"
        />
        <ReferenceLine
          y={range.max}
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
          domain={[0, TEMP_CHART_MAX_C]}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v) => `${v}${DEG_C}`}
          tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(v: unknown) => [`${Number(v ?? 0).toFixed(1)}${DEG_C}`, title]}
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
            const band = points[index]?.band ?? 'ideal';
            return (
              <rect
                x={cx - 3.25}
                y={cy - 3.25}
                width={6.5}
                height={6.5}
                rx={zone.diamondDots ? 1 : 1.5}
                fill={DOT_FILL[band]}
                stroke={CHART_COLORS.dotRing}
                strokeWidth={1}
                transform={zone.diamondDots ? `rotate(45 ${cx} ${cy})` : undefined}
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
    </MonitoringChartCard>
  );
}
