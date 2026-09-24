import { formatClockTime, parseServerDate } from '@/lib/format';
import type { Reading } from '@/types';

type ReadingMetricKey = keyof Pick<Reading, 'soil_moisture' | 'soil_temp' | 'air_temp' | 'air_humidity'>;

const HOUR_MS = 60 * 60 * 1000;
const MONITORING_CHART_HOURS = 12;

interface HourlyMonitoringPoint {
  label: string;
  reading: Reading;
  slotTime: number;
}

function readingTime(reading: Reading): number | null {
  return parseServerDate(reading.created_at)?.getTime() ?? null;
}

function startOfHour(time: number): number {
  const date = new Date(time);
  date.setMinutes(0, 0, 0);
  return date.getTime();
}

function normalizeReadings(readings: Reading[]): Reading[] {
  return readings
    .map((reading, index) => ({ reading, index, time: readingTime(reading) }))
    .sort((a, b) => {
      if (a.time == null || b.time == null) return a.index - b.index;
      return a.time - b.time || a.index - b.index;
    })
    .map(({ reading }) => reading);
}

export function getHourlyMonitoringPoints(
  readings: Reading[],
  locale: string,
  hours = MONITORING_CHART_HOURS,
): HourlyMonitoringPoint[] {
  const timedReadings = normalizeReadings(readings)
    .map((reading) => ({ reading, time: readingTime(reading) }))
    .filter((item): item is { reading: Reading; time: number } => item.time != null);

  if (timedReadings.length === 0 || hours <= 0) return [];

  const latestHour = startOfHour(timedReadings.at(-1)?.time ?? 0);
  const firstSlotTime = latestHour - (hours - 1) * HOUR_MS;
  const selectedBySlot = new Map<number, { reading: Reading; slotTime: number; time: number }>();

  for (const item of timedReadings) {
    const slot = Math.floor((item.time - firstSlotTime) / HOUR_MS);
    if (slot < 0 || slot >= hours) continue;

    const slotTime = firstSlotTime + slot * HOUR_MS;
    const current = selectedBySlot.get(slot);

    if (!current || item.time > current.time) {
      selectedBySlot.set(slot, { reading: item.reading, slotTime, time: item.time });
    }
  }

  return Array.from(selectedBySlot.entries())
    .sort(([a], [b]) => a - b)
    .map(([, item]) => ({
      label: formatTimeLabel(new Date(item.slotTime).toISOString(), locale),
      reading: item.reading,
      slotTime: item.slotTime,
    }));
}

function formatTimeLabel(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return formatClockTime(d, locale);
}

/** Latest reading value for a key, or null */
export function latestValue(readings: Reading[], key: ReadingMetricKey): number | null {
  const latest = normalizeReadings(readings)
    .map((reading) => ({ reading, time: readingTime(reading) }))
    .filter((item): item is { reading: Reading; time: number } => item.time != null)
    .at(-1);
  const value = Number(latest?.reading[key]);
  return Number.isFinite(value) ? value : null;
}
