import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Droplets } from 'lucide-react';
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { StatusTone } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { Reading } from '@/types';
import { latestValue, getHourlyMonitoringPoints } from '../chartHelpers';
import { MonitoringChartHeader } from './MonitoringChartHeader';
import { MONITORING_LINE_ANIMATION } from './monitoringChartAnimation';

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

export default function AirHumidityZoneLineChart({
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
      value: Number(reading.air_humidity),
    }));
  }, [readings, i18n.language]);

  const latestHumidity = latestValue(readings, 'air_humidity');
  const latestStatus = latestHumidity != null ? humidityStatus(latestHumidity) : null;
  const config = { hum: { label: `${t('monitoring.chartAirHumidity')} %`, color: PALETTE.main } } satisfies ChartConfig;

  return (
    <Card
      className={cn(
        embedded && 'h-full min-h-0 rounded-md bg-transparent py-3 ring-0 [--card-spacing:--spacing(3)]',
      )}
    >
      <MonitoringChartHeader
        title={t('monitoring.chartAirHumidity')}
        icon={<Droplets className="size-4 text-violet-500 dark:text-violet-400" aria-hidden="true" />}
        value={latestHumidity != null ? `${latestHumidity.toFixed(0)}%` : null}
        status={latestStatus ? { tone: latestStatus.tone, label: t(latestStatus.labelKey) } : undefined}
        sideLabel={t('monitoring.zoneIdeal')}
        sideValue={`${RANGE.min}–${RANGE.max}%`}
        embedded={embedded}
      />
      <CardContent className={cn(embedded && 'min-h-0 flex-1')}>
        <ChartContainer config={config} className={cn('w-full', embedded ? 'h-full aspect-auto' : 'h-[280px]')}>
          <ComposedChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />
            <ReferenceArea y1={0} y2={RANGE.min} fill={PALETTE.dry} fillOpacity={0.05} />
            <ReferenceArea y1={RANGE.min} y2={RANGE.max} fill={PALETTE.main} fillOpacity={0.07} />
            <ReferenceArea y1={RANGE.max} y2={CHART_MAX} fill={PALETTE.wet} fillOpacity={0.05} />
            <ReferenceLine y={RANGE.min} stroke={PALETTE.dry} strokeOpacity={0.45} strokeDasharray="5 3" />
            <ReferenceLine y={RANGE.max} stroke={PALETTE.wet} strokeOpacity={0.45} strokeDasharray="5 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} />
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
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={3.75}
                    fill="var(--card)"
                    stroke={PALETTE.light}
                    strokeWidth={2}
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
