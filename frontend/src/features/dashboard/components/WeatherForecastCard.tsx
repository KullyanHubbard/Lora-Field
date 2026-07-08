import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Check,
  ChevronRight,
  TriangleAlert,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WeatherForecastViewModel } from '@/features/dashboard/dashboardHelpers';
import { weatherIconMap } from '@/features/weather/weatherIconMap';
import { cn } from '@/lib/utils';

export function WeatherForecastCard({
  forecast,
  farmId,
  className,
}: {
  forecast: WeatherForecastViewModel | null;
  farmId: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const UnavailableIcon = weatherIconMap.unknown;

  if (!forecast) {
    return (
      <Card className={cn('flex h-full flex-col', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UnavailableIcon className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
            {t('dashboard.weatherForecastTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">{t('dashboard.weatherUnavailable')}</p>
        </CardContent>
      </Card>
    );
  }

  const CurrentIcon = weatherIconMap[forecast.currentIconKey];

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CurrentIcon className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
          {t('dashboard.weatherForecastTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="summary-subcard-interactive flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
          {forecast.rainNext3h ? (
            <TriangleAlert className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
          ) : (
            <Check className="size-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
          )}
          <span>
            {forecast.rainNext3h
              ? t('dashboard.weatherVerdictDelay')
              : t('dashboard.weatherVerdictSafe')}
          </span>
        </div>

        <div className="space-y-1 border-t border-border pt-4 text-sm">
          <p className="text-foreground">
            <span className="text-muted-foreground">{t('dashboard.weatherNow')}: </span>
            {forecast.currentTemperature} · {t(forecast.currentLabelKey)}
          </p>
          <p className="text-muted-foreground">
            {t('dashboard.airHumidity')}: {forecast.currentHumidity}
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-1 border-t border-border pt-4">
          {forecast.slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.weatherNoForecast')}</p>
          ) : (
            forecast.slots.map((slot) => {
              const SlotIcon = weatherIconMap[slot.iconKey];
              return (
                <div
                  key={slot.key}
                  className={cn(
                    'summary-subcard-interactive flex items-center gap-3 rounded-md border border-transparent px-2 py-1.5 text-sm',
                    slot.isRain && 'bg-blue-500/10',
                  )}
                >
                  <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                    {slot.time}
                  </span>
                  <SlotIcon className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
                  <span className="w-10 shrink-0 font-medium tabular-nums text-foreground">
                    {slot.temp}
                  </span>
                  <span className="truncate text-muted-foreground">{t(slot.labelKey)}</span>
                </div>
              );
            })
          )}
        </div>

        <Link
          to={`/farms/${farmId}/weather`}
          className="mt-auto flex items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('dashboard.weatherReadMore')}
          <ChevronRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
