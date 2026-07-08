import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Droplets, Wind } from 'lucide-react';
import { useFarmSummary } from '@/features/dashboard/queries';
import { useWeatherHistory } from './queries';
import {
  formatForecastLabel,
  getWeatherCodeInfo,
  pickNumber,
} from './weatherHelpers';
import { weatherIconMap } from '@/features/weather/weatherIconMap';
import { DEG_C } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FarmSummaryError } from '@/components/FarmSummaryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { Weather } from '@/types';

const CHART_COLOR = '#0ea5e9'; // sky-500 solid
const CHART_FILL_TOP = 'rgba(14,165,233,0.22)';
const CHART_FILL_BOTTOM = 'rgba(14,165,233,0.0)';
// token --foreground = oklch; pakai color-mix utk alpha biar aman light+dark
const TICK_FILL = 'color-mix(in oklch, var(--foreground) 85%, transparent)';
const GRID_STROKE = 'color-mix(in oklch, var(--foreground) 25%, transparent)';

const iconColor = (isRain: boolean): string =>
  isRain
    ? 'text-sky-500 dark:text-sky-400'
    : 'text-amber-500 dark:text-amber-400';

// ——— Temperature Chart (generic) —————————————————————————————————————————————

interface ChartPoint {
  label: string;
  value: number;
}

function TemperatureChart({ points }: { points: ChartPoint[] }) {
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
      <AreaChart
        data={points}
        margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
      >
        <defs>
          <linearGradient id="wxFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_FILL_TOP} />
            <stop offset="100%" stopColor={CHART_FILL_BOTTOM} />
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
          domain={[Math.floor(dataMin - padding), 36]}
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
            stroke: 'hsl(var(--background))',
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

// ——— Main Weather Card ————————————————————————————————————————————————————————

function WeatherMainCard({
  weather,
  history,
}: {
  weather: Weather | null;
  history: ReturnType<typeof useWeatherHistory>;
}) {
  const { t } = useTranslation();
  const info = getWeatherCodeInfo(weather?.code, weather?.condition);
  const Icon = weatherIconMap[info.iconKey];
  const temp = pickNumber(weather?.temperature);
  const humidity = pickNumber(weather?.humidity);
  const wind = pickNumber(weather?.wind_speed);
  const tempText = temp != null ? `${temp}${DEG_C}` : '—';
  const humText = humidity != null ? `${humidity}%` : '—';
  const direction = weather?.wind_direction;
  const windTextFull =
    wind != null
      ? `${wind} km/jam${direction ? ` (${direction})` : ''}`
      : '—';

  const points: ChartPoint[] = (history.data ?? []).map((p) => {
    const d = new Date(p.time);
    const label = Number.isFinite(d.getTime())
      ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : p.time;
    return { label, value: p.temp };
  });

  return (
    <Card className="flex flex-col lg:h-full lg:min-h-0">
      <CardContent className="flex flex-1 flex-col items-center pt-8 pb-5 lg:min-h-0">
        <div className="flex size-20 items-center justify-center rounded-full bg-muted/60 ring-1 ring-border">
          <Icon className={cn('size-10', iconColor(info.isRain))} />
        </div>

        <span className="mt-4 text-7xl font-extralight tracking-tighter tabular-nums text-foreground">
          {tempText}
        </span>

        <span className="mt-2.5 text-sm font-medium text-muted-foreground">
          {weather ? t(info.label) : t('weather.notAvailable')}
        </span>

        <div className="mt-7 grid w-full max-w-xs grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-border px-4 py-3">
            <Droplets className="size-4 shrink-0 text-sky-500 dark:text-sky-400" />
            <div className="min-w-0">
              <p className="text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">
                {t('weather.labelHumidity')}
              </p>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {humText}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border border-border px-4 py-3">
            <Wind className="size-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
            <div className="min-w-0">
              <p className="text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">
                {t('weather.labelWindSpeed')}
              </p>
              <p
                className="truncate text-sm font-semibold tabular-nums text-foreground"
                title={windTextFull}
              >
                {windTextFull}
              </p>
            </div>
          </div>
        </div>

        {/* Chart histori Open-Meteo */}
        <div className="mt-7 flex w-full flex-1 flex-col min-h-0">
          <p className="mb-2 text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">
            {t('weather.historyTitle')}
          </p>
          <div className="h-full min-h-[16rem] lg:min-h-0 w-full rounded-lg bg-foreground/[0.04] p-2">
            {history.isLoading ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : history.isError ? (
              <p className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                {t('weather.forecastEmpty')}
              </p>
            ) : (
              <TemperatureChart points={points} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ——— Forecast Column ——————————————————————————————————————————————————————————

function ForecastColumn({ weather }: { weather: Weather | null }) {
  const { t } = useTranslation();
  const forecast = weather?.forecast;
  const items =
    Array.isArray(forecast) && forecast.length > 0
      ? forecast.slice(0, 8)
      : [];

  return (
    <Card className="flex flex-col lg:h-full lg:min-h-0 lg:overflow-hidden">
      <CardHeader>
        <CardTitle>{t('weather.forecastTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="lg:flex lg:flex-1 lg:flex-col lg:min-h-0">
        {items.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            {t('weather.forecastEmpty')}
          </p>
        ) : (
          <div className="divide-y divide-border lg:flex lg:flex-1 lg:flex-col lg:overflow-hidden">
            {items.map((f, i) => {
              const info = getWeatherCodeInfo(
                pickNumber(f.weather, f.code),
                f.weather_desc || f.condition,
              );
              const Icon = weatherIconMap[info.iconKey];
              const temp = pickNumber(f.t, f.temperature);
              const tempText = temp != null ? `${temp}${DEG_C}` : '—';
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 py-3.5 lg:flex-1"
                >
                  <Icon
                    className={cn('size-8 shrink-0', iconColor(info.isRain))}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base font-medium tabular-nums text-foreground">
                        {formatForecastLabel(f, i)}
                      </span>
                      <span className="text-xl font-semibold tabular-nums text-foreground">
                        {tempText}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {t(info.label)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ——— Page —————————————————————————————————————————————————————————————————————

export default function WeatherPage() {
  const { t } = useTranslation();
  const { id: farmId } = useParams();
  const { data: summary, isLoading, error } = useFarmSummary(farmId ?? '');

  // Fetch Open-Meteo history PARALEL dengan farm summary — tidak perlu tunggu summary selesai.
  // Query disabled otomatis kalau farmId/koodinat belum ada.
  const history = useWeatherHistory(
    summary?.farm.latitude,
    summary?.farm.longitude,
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
          <Skeleton className="h-[36rem] w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl lg:w-72" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="mx-auto max-w-6xl">
        <FarmSummaryError
          message={
            error
              ? t('weather.errorLoad', { message: error.message })
              : t('weather.noData')
          }
        />
      </div>
    );
  }

  const weather: Weather | null = summary.weather ?? null;

  return (
    <div className="mx-auto max-w-6xl lg:flex lg:h-[calc(100svh-5.5rem)] lg:flex-col lg:overflow-hidden">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:h-full lg:min-h-0">
        <WeatherMainCard weather={weather} history={history} />
        <div className="w-full lg:w-72">
          <ForecastColumn weather={weather} />
        </div>
      </div>
    </div>
  );
}
