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
import { Droplets } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { getSoilStatusFromMoisture } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { Reading } from '@/types';
import { getHourlyMonitoringPoints, latestValue } from '@/features/monitoring/chartHelpers';
import { MonitoringChartHeader } from './MonitoringChartHeader';
import { MONITORING_LINE_ANIMATION } from './monitoringChartAnimation';
import { CHART_COLORS } from '@/lib/chartColors';
import { ACCENT_TEXT } from '@/lib/toneClasses';

// Konsisten dengan tema: cyan = garis utama, hijau = zona ideal,
// merah = batas, biru = zona basah.
const COLOR_LINE = CHART_COLORS.cyan;
const COLOR_OK = CHART_COLORS.emerald;
const COLOR_DRY = CHART_COLORS.red;
const COLOR_WET = CHART_COLORS.blue;

interface Point {
  label: string;
  value: number;
}

export default function SoilMoistureZoneChart({
  readings,
  lower,
  upper,
  embedded = false,
}: {
  readings: Reading[];
  lower: number;
  upper: number;
  embedded?: boolean;
}) {
  const { t, i18n } = useTranslation();

  const points: Point[] = useMemo(
    () =>
      getHourlyMonitoringPoints(readings, i18n.language).map(({ label, reading }) => ({
        label,
        value: reading.soil_moisture,
      })),
    [readings, i18n.language],
  );

  const latest = latestValue(readings, 'soil_moisture');
  const status = latest != null ? getSoilStatusFromMoisture(latest, lower, upper) : null;

  const config = {
    soil: { label: t('monitoring.chartSoilMoisture'), color: COLOR_LINE },
  } satisfies ChartConfig;

  return (
    <Card
      className={cn(
        embedded &&
          'h-full min-h-0 rounded-md bg-transparent py-3 ring-0 [--card-spacing:--spacing(3)]',
      )}
    >
      <MonitoringChartHeader
        title={t('monitoring.chartSoilMoisture')}
        icon={<Droplets className={cn('size-4', ACCENT_TEXT.cyan)} aria-hidden="true" />}
        value={latest != null ? `${latest.toFixed(0)}%` : null}
        status={status ? { tone: status.tone, label: t(status.labelKey) } : undefined}
        sideLabel={t('dashboard.soilTargetCaption', { lower, upper })}
        sideValue={`${lower}–${upper}%`}
        embedded={embedded}
        plotInsetClassName="pl-10 pr-3"
      />

      <CardContent className={cn(embedded && 'min-h-0 flex-1')}>
        <ChartContainer
          config={config}
          className={cn('w-full', embedded ? 'h-full aspect-auto' : 'h-[280px]')}
        >
          <ComposedChart data={points} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="currentColor"
              strokeOpacity={0.12}
            />

            {/* Zona basah (biru), di atas upper, terlalu basah */}
            <ReferenceArea y1={upper} y2={100} fill={COLOR_WET} fillOpacity={0.12} />
            {/* Zona ideal (hijau), antara lower dan upper */}
            <ReferenceArea y1={lower} y2={upper} fill={COLOR_OK} fillOpacity={0.12} />
            {/* Zona kering (merah), di bawah lower */}
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
              interval={0}
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
              dot={{ r: 2.75, fill: COLOR_LINE, stroke: COLOR_WET, strokeWidth: 1 }}
              activeDot={{
                r: 4.5,
                fill: COLOR_LINE,
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
