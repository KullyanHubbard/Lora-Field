import type { Reading } from '@/types';

export interface ChunkAggregate {
  label: string;
  min: number;
  max: number;
  avg: number;
}

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

export function groupByKey(
  readings: Reading[],
  key: ReadingMetricKey,
  chunkSize: number,
  formatLabel: (iso: string | null | undefined) => string,
): ChunkAggregate[] {
  const chunks: ChunkAggregate[] = [];
  for (let i = 0; i < readings.length; i += chunkSize) {
    const slice = readings.slice(i, i + chunkSize);
    const vals = slice.map((r) => Number(r[key]));
    chunks.push({
      label: formatLabel(slice[0]?.created_at),
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    });
  }
  return chunks;
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
