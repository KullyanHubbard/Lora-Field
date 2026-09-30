// Irigasi Terbatas (backend limited_irrigation.py): pilihan alasan, tanggal, dan format tampilan.
import { parseServerDate } from '@/lib/format';
import type { LimitedIrrigationReason } from '@/types';

// Sama dengan LIMITED_IRRIGATION_MAX_DAYS bawaan backend.
export const LIMITED_IRRIGATION_MAX_DAYS = 28;

// Lama bawaan per alasan (hari), tetap bisa diubah lewat tanggal selesai.
export const LIMITED_IRRIGATION_REASONS: { key: LimitedIrrigationReason; days: number }[] = [
  { key: 'flowering', days: 21 },
  { key: 'harvest', days: 14 },
  { key: 'other', days: 7 },
];

// Sama dengan is_rice di backend crops.py: padi butuh genangan yang tidak terukur sensor.
export function isRiceCrop(cropType: string | null | undefined): boolean {
  return (cropType ?? '').trim().toLowerCase() === 'padi';
}

// 'YYYY-MM-DD' jam lokal, nilai untuk <input type="date">.
function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateInputFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

export function limitedUntilInputValue(until: string | null | undefined): string {
  const date = parseServerDate(until);
  return date ? toDateInputValue(date) : '';
}

// Paling cepat besok, paling lambat LIMITED_IRRIGATION_MAX_DAYS dari hari ini. Tahun 5 digit ditolak.
export function isLimitedDateAllowed(value: string): boolean {
  return (
    value.length === 10 &&
    value >= dateInputFromToday(1) &&
    value <= dateInputFromToday(LIMITED_IRRIGATION_MAX_DAYS)
  );
}

// Tanggal pilihan jadi akhir hari lokal itu dalam ISO UTC, yang dikirim ke backend.
export function endOfDayIso(value: string): string {
  return new Date(`${value}T23:59:59`).toISOString();
}

const LONG_DATE: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };

export function formatDateInput(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(locale, LONG_DATE) : '';
}

export function formatLimitedUntil(until: string | null | undefined, locale: string): string {
  return parseServerDate(until)?.toLocaleDateString(locale, LONG_DATE) ?? '';
}
