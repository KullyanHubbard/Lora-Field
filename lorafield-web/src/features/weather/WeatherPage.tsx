import { Link, useParams } from 'react-router-dom';
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
import { type StatusTone } from '@/lib/status';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
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

const toneBorder: Record<StatusTone, string> = {
  green: 'border-emerald-500/50',
  yellow: 'border-amber-500/50',
  red: 'border-red-500/50',
};
const toneTextColor: Record<StatusTone, string> = {
  green: 'text-emerald-600 dark:text-emerald-400',
  yellow: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
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
  const impact: { tone: StatusTone; Icon: typeof Sun; text: string } = !weather
    ? {
        tone: 'red',
        Icon: TriangleAlert,
        text: 'Data BMKG belum tersedia. Pastikan kode BMKG kebun sudah terisi sesuai lokasi.',
      }
    : weather.rain_next_3h
      ? {
          tone: 'yellow',
          Icon: CloudRain,
          text: 'BMKG memprediksi hujan, sistem menunda irigasi untuk mencegah pemborosan air.',
        }
      : {
          tone: 'green',
          Icon: CircleCheck,
          text: 'Tidak ada prediksi hujan, sistem mengizinkan irigasi jika kelembapan tanah berada di bawah threshold bawah.',
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
  const lastUpdate = weather?.forecast_time || weather?.updated_at || 'Belum tersedia';
  const available = Boolean(weather);
  const statusLabel = available ? `${weather?.provider || 'BMKG'} tersedia` : 'Belum tersedia';

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <InfoItem label="Wilayah" value={regionText} />
        <InfoItem label="Kode BMKG" value={adm4} />
        <InfoItem label="Koordinat Kebun" value={coord} />
        <InfoItem label="Altitude BMKG" value={altitudeText} />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Status Koneksi</span>
          <StatusBadge label={statusLabel} tone={available ? 'green' : 'red'} />
        </div>
        <InfoItem label="Update Terakhir" value={lastUpdate} />
      </CardContent>
    </Card>
  );
}

function WeatherMainCard({ weather, farm }: { weather: Weather | null; farm: Farm }) {
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
  const locationText = farm.location || '';

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Icon className="size-12 text-primary" />
          <div className="flex flex-col">
            <span className="text-3xl font-semibold text-foreground">{tempText}</span>
            <span className="text-sm text-muted-foreground">{locationText}</span>
          </div>
        </div>
        <div className="space-y-2 border-t border-border pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kondisi</span>
            <span className="font-medium text-foreground">
              {weather ? weather.condition : 'Belum tersedia'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kelembapan</span>
            <span className="font-medium text-foreground">{humText}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kecepatan Angin</span>
            <span className="font-medium text-foreground">{windText}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kode Cuaca</span>
            <span className="font-medium text-foreground">{weather?.code ?? '—'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ForecastGrid({ weather }: { weather: Weather | null }) {
  const forecast = weather?.forecast;
  if (!Array.isArray(forecast) || forecast.length === 0) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          Prakiraan belum tersedia untuk kebun ini.
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
              <Icon className="size-7 text-primary" />
              <span className="text-base font-semibold text-foreground">{tempText}</span>
              <span className="text-xs text-muted-foreground">
                {f.weather_desc || f.condition || '—'}
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function WeatherPage() {
  const { id: farmId } = useParams();
  const { data: summary, isLoading, error } = useFarmSummary(farmId ?? '');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="space-y-3">
        <p className="text-destructive">
          {error ? `Gagal memuat data cuaca: ${error.message}` : 'Data tidak tersedia.'}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">Kembali ke Daftar Kebun</Link>
        </Button>
      </div>
    );
  }

  // Type menandai weather wajib, tapi backend bisa kirim null kalau adm4 belum resolve
  // (lihat LAPORAN). Pertahankan guard no-data seperti page lama.
  const weather: Weather | null = summary.weather ?? null;
  const farm = summary.farm;

  return (
    <div className="space-y-4">
      <ImpactCard weather={weather} />
      <WeatherInfoCard weather={weather} farm={farm} />
      <WeatherMainCard weather={weather} farm={farm} />
      <ForecastGrid weather={weather} />
    </div>
  );
}
