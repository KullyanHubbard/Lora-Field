// Domain logic cuaca: diport dari frontend React lama (pages/WeatherPage.jsx:
// WEATHER_CODES, getWeatherCodeInfo, pickNumber, formatForecastLabel) dan
// getWeatherInfo dari utils/farmStatusHelpers.js.
//
// Catatan port: versi lama menyimpan ikon sebagai kelas FontAwesome ('fas fa-...').
// Build baru pakai lucide, jadi di sini ikon disimpan sebagai `iconKey` semantik;
// pemetaan iconKey -> komponen ikon dilakukan di lapisan UI. Label/isRain/kode
// dipertahankan apa adanya.
import type { TFunction } from 'i18next';
import { formatClockTime } from '@/lib/format';
import type { WeatherForecastPoint } from '@/types';

export type WeatherIconKey =
  'sun' | 'cloud-sun' | 'cloud' | 'cloud-rain' | 'cloud-showers' | 'cloud-bolt' | 'unknown';

interface WeatherCodeInfo {
  label: string;
  iconKey: WeatherIconKey;
  isRain: boolean;
}

interface WeatherCodeEntry extends WeatherCodeInfo {
  code: number;
}

export function pickNumber(...values: unknown[]): number | null {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getWeatherInfo(condition: string = ''): WeatherCodeInfo {
  const text = String(condition || '').toLowerCase();
  if (text.includes('hujan lebat') || text.includes('thunderstorm')) {
    return { label: 'weatherCode.heavyRain', iconKey: 'cloud-bolt', isRain: true };
  }
  if (text.includes('hujan sedang')) {
    return { label: 'weatherCode.moderateRain', iconKey: 'cloud-showers', isRain: true };
  }
  if (text.includes('hujan ringan') || text.includes('hujan') || text.includes('shower')) {
    return { label: 'weatherCode.lightRain', iconKey: 'cloud-rain', isRain: true };
  }
  if (text.includes('berawan tebal')) {
    return { label: 'weatherCode.heavyCloudy', iconKey: 'cloud', isRain: false };
  }
  if (text.includes('cerah berawan')) {
    return { label: 'weatherCode.partlyCloudy', iconKey: 'cloud-sun', isRain: false };
  }
  if (text.includes('cerah')) {
    return { label: 'weatherCode.clear', iconKey: 'sun', isRain: false };
  }
  if (text.includes('berawan')) {
    return { label: 'weatherCode.cloudy', iconKey: 'cloud', isRain: false };
  }
  return { label: 'weatherCode.unknown', iconKey: 'unknown', isRain: false };
}

const WEATHER_CODES: WeatherCodeEntry[] = [
  { code: 0, label: 'weatherCode.clear', iconKey: 'sun', isRain: false },
  { code: 1, label: 'weatherCode.partlyCloudy', iconKey: 'cloud-sun', isRain: false },
  { code: 2, label: 'weatherCode.partlyCloudy', iconKey: 'cloud-sun', isRain: false },
  { code: 3, label: 'weatherCode.cloudy', iconKey: 'cloud', isRain: false },
  { code: 4, label: 'weatherCode.heavyCloudy', iconKey: 'cloud', isRain: false },
  { code: 60, label: 'weatherCode.lightRain', iconKey: 'cloud-rain', isRain: true },
  { code: 61, label: 'weatherCode.moderateRain', iconKey: 'cloud-showers', isRain: true },
  { code: 63, label: 'weatherCode.heavyRain', iconKey: 'cloud-bolt', isRain: true },
];

const WEATHER_CODE_MAP = new Map<number, WeatherCodeEntry>(WEATHER_CODES.map((w) => [w.code, w]));

export function getWeatherCodeInfo(
  code: number | string | null | undefined,
  condition?: string,
): WeatherCodeInfo {
  const num = Number(code);
  const entry = Number.isFinite(num) ? WEATHER_CODE_MAP.get(num) : undefined;
  if (entry) {
    return { label: entry.label, iconKey: entry.iconKey, isRain: entry.isRain };
  }
  return getWeatherInfo(condition);
}

export function formatForecastLabel(
  item: WeatherForecastPoint,
  index: number,
  t: TFunction,
  locale: string,
): string {
  const fallback = index === 0 ? t('weather.now') : t('weather.hoursAhead', { count: index * 3 });
  const rawTime = item.local_datetime || item.datetime || item.utc_datetime;
  if (!rawTime) return fallback;
  const date = new Date(String(rawTime).replace(' ', 'T'));
  if (!Number.isNaN(date.getTime())) return formatClockTime(date, locale);
  const timePart = String(rawTime).split(/[ T]/)[1];
  return timePart ? timePart.slice(0, 5) : fallback;
}
