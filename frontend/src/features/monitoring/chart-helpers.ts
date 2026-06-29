import type { Reading } from '@/types';

export interface ChunkAggregate {
  label: string;
  min: number;
  max: number;
  avg: number;
}

/** Simple moving average — returns null for leading edges where window isn't full */
export function movingAverage(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += values[j];
    return sum / window;
  });
}

/** Bollinger Bands: middle = SMA, upper/lower = middle ± multiplier × stddev */
export function bollingerBands(
  values: number[],
  period: number,
  multiplier: number,
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = movingAverage(values, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (middle[i] == null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let sumSq = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (values[j] - middle[i]!) ** 2;
      count++;
    }
    const stddev = Math.sqrt(sumSq / count);
    upper.push(middle[i]! + multiplier * stddev);
    lower.push(middle[i]! - multiplier * stddev);
  }
  return { upper, middle, lower };
}

export type SoilZone = 'danger' | 'optimal' | 'warning';

export function classifySoilZone(value: number, lower: number, upper: number): SoilZone {
  if (value < lower) return 'danger';
  if (value > upper) return 'warning';
  return 'optimal';
}

export function groupByKey(
  readings: Reading[],
  key: keyof Pick<Reading, 'soil_moisture' | 'soil_temp' | 'air_temp' | 'air_humidity'>,
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

export function avgOfReadings(readings: Reading[], key: keyof Reading): number | null {
  if (readings.length === 0) return null;
  return readings.reduce((s, r) => s + Number(r[key]), 0) / readings.length;
}

export function formatTimeLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/** Latest reading value for a key, or null */
export function latestValue(readings: Reading[], key: keyof Reading): number | null {
  if (readings.length === 0) return null;
  return Number(readings[readings.length - 1][key]);
}