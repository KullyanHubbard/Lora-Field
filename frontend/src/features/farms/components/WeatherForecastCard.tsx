import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Check,
  ChevronRight,
  Cloud,
  CloudLightning,
  CloudOff,
  CloudRain,
  CloudRainWind,
  CloudSun,
  Sun,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WeatherForecastViewModel } from '@/features/farms/farmDetailHelpers';
import { cn } from '@/lib/utils';
import type { WeatherIconKey } from '@/features/weather/weatherHelpers';

const weatherIcon: Record<WeatherIconKey, LucideIcon> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  'cloud-showers': CloudRainWind,
  'cloud-bolt': CloudLightning,
  unknown: CloudOff,
};

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

  if (!forecast) {
    return (
      <Card className={cn('flex h-full flex-col', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudOff className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
            {t('farmDetail.weatherForecastTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">{t('farmDetail.weatherUnavailable')}</p>
        </CardContent>
      </Card>
    );
  }

  const CurrentIcon = weatherIcon[forecast.currentIconKey];

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CurrentIcon className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
          {t('farmDetail.weatherForecastTitle')}
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
              ? t('farmDetail.weatherVerdictDelay')
              : t('farmDetail.weatherVerdictSafe')}
          </span>
        </div>

        <div className="space-y-1 border-t border-border pt-4 text-sm">
          <p className="text-foreground">
            <span className="text-muted-foreground">{t('farmDetail.weatherNow')}: </span>
            {forecast.currentTemperature} · {t(forecast.currentLabelKey)}
          </p>
          <p className="text-muted-foreground">
            {t('farmDetail.airHumidity')}: {forecast.currentHumidity}
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-1 border-t border-border pt-4">
          {forecast.slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('farmDetail.weatherNoForecast')}</p>
          ) : (
            forecast.slots.map((slot) => {
              const SlotIcon = weatherIcon[slot.iconKey];
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
          Selengkapnya
          <ChevronRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
