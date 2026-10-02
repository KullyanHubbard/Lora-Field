import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { CHART_COLORS } from '@/lib/chartColors';
import { DEG_C } from '@/lib/format';
import { WEATHER_CHART_MIN_TOP_C } from '@/features/weather/constants';

const CHART_COLOR = CHART_COLORS.sky;
// Token --foreground berupa oklch; color-mix dipakai untuk memberi transparansi.
const TICK_FILL = 'color-mix(in oklch, var(--foreground) 85%, transparent)';
const GRID_STROKE = 'color-mix(in oklch, var(--foreground) 25%, transparent)';

export interface ChartPoint {
  label: string;
  value: number;
}

export function TemperatureChart({ points }: { points: ChartPoint[] }) {
  const { t } = useTranslation();

  if (points.length < 2) {
    return (
      <p className="flex items-center justify-center py-10 text-xs text-muted-foreground">
        {t('weather.forecastEmpty')}
      </p>
    );
  }

  const dataMin = Math.min(...points.map((p) => p.value));
  const dataMax = Math.max(...points.map((p) => p.value));
  const padding = Math.max(2, Math.ceil((dataMax - dataMin) * 0.25));

  const chartConfig = {
    value: {
      label: t('weather.labelTemperature') ?? 'Suhu',
      color: CHART_COLOR,
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="h-full min-h-0 w-full">
      <AreaChart data={points} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="wxFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLOR} stopOpacity={0.22} />
            <stop offset="100%" stopColor={CHART_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={true}
          horizontal={true}
          stroke={GRID_STROKE}
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          tick={{ fill: TICK_FILL }}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickMargin={4}
          tick={{ fill: TICK_FILL }}
          tickFormatter={(v) => `${v}${DEG_C}`}
          domain={[
            Math.floor(dataMin - padding),
            Math.max(WEATHER_CHART_MIN_TOP_C, Math.ceil(dataMax + padding)),
          ]}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(value) => (
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {Number(value).toFixed(1)}
                  {DEG_C}
                </span>
              )}
            />
          }
        />
        <Area
          dataKey="value"
          type="monotone"
          stroke={CHART_COLOR}
          strokeWidth={2.5}
          fill="url(#wxFill)"
          dot={{
            r: 3,
            fill: CHART_COLOR,
            strokeWidth: 0,
          }}
          activeDot={{
            r: 5,
            fill: CHART_COLOR,
            stroke: 'var(--background)',
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
