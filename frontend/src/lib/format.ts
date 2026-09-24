// Helper format murni, diport dari frontend React lama (utils/farmStatusHelpers.js).
// Tanpa side effect; semua input dari argument.
import type { TFunction } from 'i18next';

export const DEG_C = '°C';

// Penanda nilai kosong di seluruh UI. Satu tempat supaya gampang diganti.
export const EMPTY_VALUE = '—';

// Waktu dari backend (SQLite CURRENT_TIMESTAMP) = UTC tanpa penanda zona,
// "YYYY-MM-DD HH:MM:SS". new Date() membacanya sebagai jam lokal (meleset 7 jam
// di WIB), jadi tandai UTC dulu. Nilai yang sudah punya zona dibaca apa adanya.
// Jangan dipakai untuk waktu prakiraan BMKG/Open-Meteo: itu sudah jam lokal.
const NAIVE_SERVER_TIME = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

export function parseServerDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const date =
    typeof value === 'string' && NAIVE_SERVER_TIME.test(value)
      ? new Date(`${value.replace(' ', 'T')}Z`)
      : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

// "YYYY-MM-DD HH:MM:SS" dalam jam lokal, untuk ekspor CSV.
export function formatLocalDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

// Jam 24 jam di semua bahasa supaya lebar label tetap; pemisahnya ikut locale
// ('id' -> 17.06, 'en' -> 17:06).
export function formatClockTime(date: Date, locale: string, withSeconds = false): string {
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hourCycle: 'h23',
  });
}

export function timeAgo(
  date: string | number | Date | null | undefined,
  t: TFunction,
): string {
  const parsed = parseServerDate(date);
  if (!parsed) return t('time.unavailable');
  const diff = Math.max(Math.floor((Date.now() - parsed.getTime()) / 1000), 0);
  if (diff < 5) return t('time.justNow');
  if (diff < 60) return t('time.secondsAgo', { count: diff });
  if (diff < 3600) return t('time.minutesAgo', { count: Math.floor(diff / 60) });
  if (diff < 86400) return t('time.hoursAgo', { count: Math.floor(diff / 3600) });
  return t('time.daysAgo', { count: Math.floor(diff / 86400) });
}

export function formatAreaHa(areaHa: number | string | null | undefined): string {
  if (areaHa == null || areaHa === '') return EMPTY_VALUE;
  return `${areaHa} ha`;
}
