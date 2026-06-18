// Domain logic cuaca — diport dari frontend/src/pages/WeatherPage.jsx
// (WEATHER_CODES, getWeatherCodeInfo, pickNumber, formatForecastLabel) dan
// getWeatherInfo dari frontend/src/utils/farmHelpers.js.
//
// Catatan port: versi lama menyimpan ikon sebagai kelas FontAwesome ('fas fa-...').
// Build baru pakai lucide, jadi di sini ikon disimpan sebagai `iconKey` semantik;
// pemetaan iconKey -> komponen ikon dilakukan di lapisan UI. Label/isRain/kode
// dipertahankan apa adanya.
import type { WeatherForecastPoint } from '@/types';

export type WeatherIconKey =
  | 'sun'
  | 'cloud-sun'
  | 'cloud'
  | 'cloud-rain'
  | 'cloud-showers'
  | 'cloud-bolt'
  | 'unknown';

export interface WeatherCodeInfo {
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

export function getWeatherInfo(condition: string = ''): WeatherCodeInfo {
  const text = String(condition || '').toLowerCase();
  if (text.includes('hujan lebat') || text.includes('thunderstorm')) {
    return { label: 'Hujan Lebat', iconKey: 'cloud-bolt', isRain: true };
  }
  if (text.includes('hujan sedang')) {
    return { label: 'Hujan Sedang', iconKey: 'cloud-showers', isRain: true };
  }
  if (text.includes('hujan ringan') || text.includes('hujan') || text.includes('shower')) {
    return { label: 'Hujan Ringan', iconKey: 'cloud-rain', isRain: true };
  }
  if (text.includes('berawan tebal')) {
    return { label: 'Berawan Tebal', iconKey: 'cloud', isRain: false };
  }
  if (text.includes('cerah berawan')) {
    return { label: 'Cerah Berawan', iconKey: 'cloud-sun', isRain: false };
  }
  if (text.includes('cerah')) {
    return { label: 'Cerah', iconKey: 'sun', isRain: false };
  }
  if (text.includes('berawan')) {
    return { label: 'Berawan', iconKey: 'cloud', isRain: false };
  }
  return { label: condition || 'Tidak diketahui', iconKey: 'unknown', isRain: false };
}

export const WEATHER_CODES: WeatherCodeEntry[] = [
  { code: 0, label: 'Cerah', iconKey: 'sun', isRain: false },
  { code: 1, label: 'Cerah Berawan', iconKey: 'cloud-sun', isRain: false },
  { code: 2, label: 'Cerah Berawan', iconKey: 'cloud-sun', isRain: false },
  { code: 3, label: 'Berawan', iconKey: 'cloud', isRain: false },
  { code: 4, label: 'Berawan Tebal', iconKey: 'cloud', isRain: false },
  { code: 60, label: 'Hujan Ringan', iconKey: 'cloud-rain', isRain: true },
  { code: 61, label: 'Hujan Sedang', iconKey: 'cloud-showers', isRain: true },
  { code: 63, label: 'Hujan Lebat', iconKey: 'cloud-bolt', isRain: true },
];

const WEATHER_CODE_MAP = new Map<number, WeatherCodeEntry>(
  WEATHER_CODES.map((w) => [w.code, w]),
);

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

export function formatForecastLabel(item: WeatherForecastPoint, index: number): string {
  const rawTime = item.local_datetime || item.datetime || item.utc_datetime;
  if (!rawTime) return index === 0 ? 'Sekarang' : `+${index * 3} Jam`;
  const normalized = String(rawTime).replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    const timePart = String(rawTime).split(' ')[1];
    return timePart ? timePart.slice(0, 5) : index === 0 ? 'Sekarang' : `+${index * 3} Jam`;
  }
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
