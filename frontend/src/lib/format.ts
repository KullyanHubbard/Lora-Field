// Helper format murni — diport dari frontend React lama (utils/farmHelpers.js)
// (DEG_C, timeAgo, formatAreaHa). Tanpa side effect; semua input dari argument.

export const DEG_C = '°C';

export function timeAgo(date: string | number | Date | null | undefined): string {
  if (!date) return 'Tidak tersedia';
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return 'Tidak tersedia';
  const diff = Math.max(Math.floor((Date.now() - timestamp) / 1000), 0);
  if (diff < 5) return 'Baru saja';
  if (diff < 60) return `${diff} detik lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

export function formatAreaHa(areaHa: number | string | null | undefined): string {
  if (areaHa == null || areaHa === '') return '—';
  return `${areaHa} ha`;
}
