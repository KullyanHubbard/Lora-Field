import { formatClockTime, parseServerDate } from '@/lib/format';
import type { StatusTone } from '@/lib/status';
import { ACCENT_TEXT } from '@/lib/toneClasses';
import type { Reading } from '@/types';
import { HOUR_MS, MONITORING_WINDOW_HOURS, startOfHour } from '@/lib/timeWindows';

type ReadingMetricKey = keyof Pick<
  Reading,
  'soil_moisture' | 'soil_temp' | 'air_temp' | 'air_humidity'
>;

// Batas atas sumbu Y grafik suhu tanah dan udara.
export const TEMP_CHART_MAX_C = 50;

export type TempBand = 'low' | 'ideal' | 'high';

// Satu grafik suhu (TempZoneLineChart) untuk suhu udara dan suhu tanah. Yang beda hanya data di sini:
// rentang ideal, teks dan warna status tiap pita, warna ikon, dan bentuk titik.
export interface TempZone {
  metric: 'air_temp' | 'soil_temp';
  titleKey: string;
  iconClass: string;
  range: { min: number; max: number };
  status: Record<TempBand, { labelKey: string; tone: StatusTone }>;
  // Titik belah ketupat supaya suhu tanah beda dari suhu udara.
  diamondDots: boolean;
}

export const AIR_TEMP_ZONE: TempZone = {
  metric: 'air_temp',
  titleKey: 'monitoring.chartAirTemp',
  iconClass: ACCENT_TEXT.red,
  range: { min: 24, max: 32 },
  status: {
    low: { labelKey: 'monitoring.airStatus.cool', tone: 'green' },
    ideal: { labelKey: 'monitoring.airStatus.normal', tone: 'green' },
    high: { labelKey: 'monitoring.airStatus.hot', tone: 'red' },
  },
  diamondDots: false,
};

export const SOIL_TEMP_ZONE: TempZone = {
  metric: 'soil_temp',
  titleKey: 'monitoring.chartSoilTemp',
  iconClass: ACCENT_TEXT.amber,
  range: { min: 18, max: 28 },
  status: {
    low: { labelKey: 'monitoring.soilTempStatus.cold', tone: 'yellow' },
    ideal: { labelKey: 'monitoring.soilTempStatus.normal', tone: 'green' },
    high: { labelKey: 'monitoring.soilTempStatus.warm', tone: 'red' },
  },
  diamondDots: true,
};

export function tempBand(value: number, range: TempZone['range']): TempBand {
  if (value < range.min) return 'low';
  if (value > range.max) return 'high';
  return 'ideal';
}

interface HourlyMonitoringPoint {
  label: string;
  reading: Reading;
  slotTime: number;
}

function readingTime(reading: Reading): number | null {
  return parseServerDate(reading.created_at)?.getTime() ?? null;
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
  hours = MONITORING_WINDOW_HOURS,
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
