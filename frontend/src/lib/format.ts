// Helper format murni — diport dari frontend React lama (utils/farmStatusHelpers.js)
// (DEG_C, timeAgo, formatAreaHa). Tanpa side effect; semua input dari argument.
import type { TFunction } from 'i18next';

export const DEG_C = '°C';

export function timeAgo(
  date: string | number | Date | null | undefined,
  t: TFunction,
): string {
  if (!date) return t('time.unavailable');
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return t('time.unavailable');
  const diff = Math.max(Math.floor((Date.now() - timestamp) / 1000), 0);
  if (diff < 5) return t('time.justNow');
  if (diff < 60) return t('time.secondsAgo', { count: diff });
  if (diff < 3600) return t('time.minutesAgo', { count: Math.floor(diff / 60) });
  if (diff < 86400) return t('time.hoursAgo', { count: Math.floor(diff / 3600) });
  return t('time.daysAgo', { count: Math.floor(diff / 86400) });
}

export function formatAreaHa(areaHa: number | string | null | undefined): string {
  if (areaHa == null || areaHa === '') return '—';
  return `${areaHa} ha`;
}
