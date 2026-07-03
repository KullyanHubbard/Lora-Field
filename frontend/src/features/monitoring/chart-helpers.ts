import type { Reading } from '@/types';

export type ReadingMetricKey = keyof Pick<Reading, 'soil_moisture' | 'soil_temp' | 'air_temp' | 'air_humidity'>;

function readingTime(reading: Reading): number | null {
  const time = Date.parse(reading.created_at);
  return Number.isFinite(time) ? time : null;
}

export function normalizeReadings(readings: Reading[]): Reading[] {
  return readings
    .map((reading, index) => ({ reading, index, time: readingTime(reading) }))
    .sort((a, b) => {
      if (a.time == null || b.time == null) return a.index - b.index;
      return a.time - b.time || a.index - b.index;
    })
    .map(({ reading }) => reading);
}

export function formatTimeLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/** Latest reading value for a key, or null */
export function latestValue(readings: Reading[], key: ReadingMetricKey): number | null {
  if (readings.length === 0) return null;
  const latest = normalizeReadings(readings).at(-1);
  if (!latest) return null;
  const value = Number(latest[key]);
  return Number.isFinite(value) ? value : null;
}
