// Adapter chart historis dashboard: reading node diringkas jadi rata-rata per slot 30 menit.
import { formatClockTime, parseServerDate } from '@/lib/format';
import type { Reading } from '@/types';
import {
  HOUR_MS,
  METRIC_CARD_SLOT_MINUTES,
  METRIC_CARD_WINDOW_HOURS,
  startOfSlot,
} from '@/lib/timeWindows';

const SLOT_MS = METRIC_CARD_SLOT_MINUTES * 60 * 1000;

export interface FarmMetricChartPoint {
  label: string; // jam "HH.MM" (format id-ID), jarak antar titik METRIC_CARD_SLOT_MINUTES
  soil_moisture: number; // %
  soil_temp: number; // °C
  air_temp: number; // °C
  air_humidity: number; // %
}

// Metrik yang tidak punya nilai valid di satu slot jadi NaN, bukan 0.
function average(values: number[]): number {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return Number.NaN;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

// Rata-rata per slot dari reading dalam METRIC_CARD_WINDOW_HOURS terakhir (slot berjalan ikut).
// Slot tanpa reading dilewati, jadi titik bisa kurang dari rentangnya.
export function buildSlotMetricPoints(
  readings: Reading[],
  now: number,
  locale: string,
): FarmMetricChartPoint[] {
  const currentSlot = startOfSlot(now, METRIC_CARD_SLOT_MINUTES);
  const windowStart = currentSlot + SLOT_MS - METRIC_CARD_WINDOW_HOURS * HOUR_MS;
  const buckets = new Map<number, Reading[]>();

  for (const reading of readings) {
    const time = parseServerDate(reading.created_at)?.getTime();
    if (time == null || time < windowStart) continue;
    const slot = Math.min(startOfSlot(time, METRIC_CARD_SLOT_MINUTES), currentSlot);
    buckets.set(slot, [...(buckets.get(slot) ?? []), reading]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([slot, items]) => ({
      label: formatClockTime(new Date(slot), locale),
      soil_moisture: average(items.map((item) => item.soil_moisture)),
      soil_temp: average(items.map((item) => item.soil_temp)),
      air_temp: average(items.map((item) => item.air_temp)),
      air_humidity: average(items.map((item) => item.air_humidity)),
    }));
}
