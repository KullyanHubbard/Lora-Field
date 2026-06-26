import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CircleCheck,
  Cloud,
  CloudLightning,
  CloudOff,
  CloudRain,
  CloudRainWind,
  CloudSun,
  Sun,
  TriangleAlert,
} from 'lucide-react';
import { useFarmSummary } from '@/features/farms/queries';
import {
  formatForecastLabel,
  getWeatherCodeInfo,
  pickNumber,
  type WeatherIconKey,
} from './weatherHelpers';
import { DEG_C } from '@/lib/format';
import { cn } from '@/lib/utils';
import { StatusPill, type PillTone } from '@/components/ui/status-pill';
import { FarmSummaryError } from '@/components/FarmSummaryError';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Farm, Weather } from '@/types';

const weatherIcon: Record<WeatherIconKey, typeof Sun> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  'cloud-showers': CloudRainWind,
  'cloud-bolt': CloudLightning,
  unknown: CloudOff,
};

const toneBorder: Record<PillTone, string> = {
  green: 'border-emerald-500/50',
  yellow: 'border-amber-500/50',
  red: 'border-red-500/50',
  neutral: 'border-border',
};
const toneTextColor: Record<PillTone, string> = {
  green: 'text-emerald-600 dark:text-emerald-400',
  yellow: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  neutral: 'text-muted-foreground',
};

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function ImpactCard({ weather }: { weather: Weather | null }) {
  const { t } = useTranslation();
  // No-data BMKG → neutral (bukan merah). Hujan → amber (perhatian). Aman → green.
  const impact: { tone: PillTone; Icon: typeof Sun; text: string } = !weather
    ? {
        tone: 'neutral',
        Icon: TriangleAlert,
        text: t('weather.impactNoData'),
      }
    : weather.rain_next_3h
      ? {
          tone: 'yellow',
          Icon: CloudRain,
          text: t('weather.impactRain'),
        }
      : {
          tone: 'green',
          Icon: CircleCheck,
          text: t('weather.impactClear'),
        };
  const Icon = impact.Icon;

  return (
    <Card className={toneBorder[impact.tone]}>
      <CardContent className={cn('flex items-center gap-3 text-sm', toneTextColor[impact.tone])}>
        <Icon className="size-5 shrink-0" />
        <span>{impact.text}</span>
      </CardContent>
    </Card>
  );
}

function WeatherInfoCard({ weather, farm }: { weather: Weather | null; farm: Farm }) {
  const { t } = useTranslation();
  const r = weather?.region;
  const regionText =
    [r?.village, r?.district, r?.city, r?.province].filter(Boolean).join(', ') ||
    farm.location ||
    '—';
  const adm4 = weather?.adm4 || farm.bmkg_adm4_code || '—';
  const lat = Number(farm.latitude);
  const lng = Number(farm.longitude);
  const coord =
    Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : '—';
  const altitude = pickNumber(weather?.location_profile?.altitude_m);
  const altitudeText = altitude != null ? `${altitude} mdpl` : '—';
  const lastUpdate = weather?.forecast_time || weather?.updated_at || t('weather.notAvailable');
  const available = Boolean(weather);
  const statusLabel = available ? `${weather?.provider || 'BMKG'} ${t('weather.statusAvailable')}` : t('weather.notAvailable');

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <InfoItem label={t('weather.labelRegion')} value={regionText} />
        <InfoItem label={t('weather.labelBmkgCode')} value={adm4} />
        <InfoItem label={t('weather.labelCoord')} value={coord} />
        <InfoItem label={t('weather.labelAltitude')} value={altitudeText} />
        <div className="flex flex-col items-start gap-1">
          <span className="text-xs text-muted-foreground">{t('weather.labelConnStatus')}</span>
          <StatusPill tone={available ? 'green' : 'neutral'} label={statusLabel} />
        </div>
        <InfoItem label={t('weather.labelLastUpdate')} value={lastUpdate} />
      </CardContent>
    </Card>
  );
}

function WeatherMainCard({ weather }: { weather: Weather | null }) {
  const { t } = useTranslation();
  const info = getWeatherCodeInfo(weather?.code, weather?.condition);
  const Icon = weatherIcon[info.iconKey];
  const temp = pickNumber(weather?.temperature);
  const humidity = pickNumber(weather?.humidity);
  const wind = pickNumber(weather?.wind_speed);
  const tempText = temp != null ? `${temp}${DEG_C}` : '—';
  const humText = humidity != null ? `${humidity}%` : '—';
  const windText =
    wind != null
      ? `${wind} km/jam${weather?.wind_direction ? ` (${weather.wind_direction})` : ''}`
      : '—';

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Icon className="size-12 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-4xl font-semibold tracking-tight tabular-nums text-foreground">
              {tempText}
            </span>
            <span className="text-sm text-muted-foreground">
              {weather ? t(info.label) : t('weather.notAvailable')}
            </span>
          </div>
        </div>
        <div className="space-y-2 border-t border-border pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('weather.labelHumidity')}</span>
            <span className="font-medium tabular-nums text-foreground">{humText}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('weather.labelWindSpeed')}</span>
            <span className="font-medium text-foreground">{windText}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('weather.labelWeatherCode')}</span>
            <span className="font-medium tabular-nums text-foreground">{weather?.code ?? '—'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ForecastGrid({ weather }: { weather: Weather | null }) {
  const { t } = useTranslation();
  const forecast = weather?.forecast;
  if (!Array.isArray(forecast) || forecast.length === 0) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          {t('weather.forecastEmpty')}
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {forecast.slice(0, 8).map((f, i) => {
        const info = getWeatherCodeInfo(pickNumber(f.weather, f.code), f.weather_desc || f.condition);
        const Icon = weatherIcon[info.iconKey];
        const temp = pickNumber(f.t, f.temperature);
        const tempText = temp != null ? `${temp}${DEG_C}` : '—';
        return (
          <Card key={i}>
            <CardContent className="flex flex-col items-center gap-1.5 text-center">
              <span className="text-xs text-muted-foreground">{formatForecastLabel(f, i)}</span>
              <Icon className="size-7 text-muted-foreground" />
              <span className="text-lg font-semibold tabular-nums text-foreground">{tempText}</span>
              <span className="text-xs text-muted-foreground">
                {t(info.label)}
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function WeatherPage() {
  const { t } = useTranslation();
  const { id: farmId } = useParams();
  const { data: summary, isLoading, error } = useFarmSummary(farmId ?? '');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <FarmSummaryError
        message={
          error ? t('weather.errorLoad', { message: error.message }) : t('weather.noData')
        }
      />
    );
  }

  // Type menandai weather wajib, tapi backend bisa kirim null kalau adm4 belum resolve.
  const weather: Weather | null = summary.weather ?? null;
  const farm = summary.farm;

  return (
    <div className="space-y-6">
      <ImpactCard weather={weather} />
      <WeatherInfoCard weather={weather} farm={farm} />
      <WeatherMainCard weather={weather} />
      <ForecastGrid weather={weather} />
    </div>
  );
}
