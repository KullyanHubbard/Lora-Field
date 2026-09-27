import {
  buildSlotMetricPoints,
  type FarmMetricChartPoint,
} from '@/features/dashboard/dashboardHistoricalData';
import { BATTERY_LOW_PCT, BATTERY_MID_PCT, batteryTone } from '@/lib/status';
import type { TFunction } from 'i18next';
import { DEG_C, EMPTY_VALUE, formatClockTime, parseServerDate } from '@/lib/format';
import {
  dropPastForecast,
  formatForecastLabel,
  getWeatherCodeInfo,
  pickNumber,
  type WeatherIconKey,
} from '@/features/weather/weatherHelpers';
import type { NodeSummary, Reading, SemanticTone, Weather } from '@/types';
import { ACCENT_BG } from '@/lib/toneClasses';

type NumberStats = {
  min: number;
  max: number;
  avg: number;
};

// Jumlah slot prakiraan di kartu Prediksi Cuaca Ringkasan Kebun.
const FORECAST_CARD_SLOTS = 6;

export type ValveSummary = {
  bars: string[];
  totalCount: number;
  openCount: number;
  closedCount: number;
  offlineCount: number;
};

type BatteryGaugeModel = {
  pct: number | null;
  tone: SemanticTone;
  centerLabel: string;
  centerSubKey?: string;
};

type WeatherForecastSlot = {
  key: number;
  time: string;
  iconKey: WeatherIconKey;
  labelKey: string;
  temp: string;
  isRain: boolean;
};

export type WeatherForecastViewModel = {
  currentIconKey: WeatherIconKey;
  currentLabelKey: string;
  currentTemperature: string;
  currentHumidity: string;
  rainNext3h: boolean;
  slots: WeatherForecastSlot[];
  // null kalau cuaca segar (is_stale bukan true) atau fetched_at tidak bisa dibaca.
  staleSince: string | null;
};

function toFiniteNumber(value: number | null | undefined): number | null {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatRounded(value: number | null | undefined, suffix = ''): string {
  const numeric = toFiniteNumber(value);
  return numeric == null ? EMPTY_VALUE : `${Math.round(numeric)}${suffix}`;
}

function formatPercent(value: number | null | undefined): string {
  const numeric = toFiniteNumber(value);
  return numeric == null ? EMPTY_VALUE : `${clampPercent(numeric)}%`;
}

export function calcMinMaxAvg(values: number[]): NumberStats | null {
  if (values.length === 0) return null;

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;

  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  }

  if (!Number.isFinite(min)) return null;
  return { min, max, avg: sum / values.length };
}

export const VALVE_BAR_CLASSES = {
  open: ACCENT_BG.emerald,
  closed: ACCENT_BG.amber,
  offline: ACCENT_BG.red,
} as const;

type ValveBarState = keyof typeof VALVE_BAR_CLASSES;

export function buildValveSummary(nodes: NodeSummary[]): ValveSummary {
  const states: ValveBarState[] = nodes.map((ns) => {
    if (ns.node.status === 'offline') return 'offline';
    return ns.decision?.valve_state === 'open' ? 'open' : 'closed';
  });

  const bars = states.map((state) => VALVE_BAR_CLASSES[state]);
  const totalCount = nodes.length;
  const openCount = states.filter((state) => state === 'open').length;
  const offlineCount = states.filter((state) => state === 'offline').length;
  const closedCount = totalCount - openCount - offlineCount;

  return { bars, totalCount, openCount, closedCount, offlineCount };
}

export function buildBatteryGaugeModel(value: number | null | undefined): BatteryGaugeModel {
  const numeric = toFiniteNumber(value);
  const pct = numeric != null ? clampPercent(numeric) : null;
  const tone: SemanticTone = pct != null ? batteryTone(pct) : 'neutral';
  const centerSubKey =
    pct == null
      ? undefined
      : pct < BATTERY_LOW_PCT
        ? 'dashboard.batteryLow'
        : pct <= BATTERY_MID_PCT
          ? 'dashboard.batteryMid'
          : 'dashboard.batteryOk';

  return {
    pct,
    tone,
    centerLabel: pct != null ? `${pct}%` : EMPTY_VALUE,
    centerSubKey,
  };
}

// Label node untuk UI: nama, kalau kosong lokasi, kalau kosong ID.
export function getNodeLabel(node: NodeSummary['node']): string {
  return node.name || node.location || node.id;
}

export function getSelectedNodeSummary(
  nodes: NodeSummary[],
  selectedId: string | null,
): NodeSummary | null {
  return nodes.find((ns) => ns.node.id === selectedId) ?? nodes[0] ?? null;
}

export function getValidMetricNodeId(nodes: NodeSummary[], selectedId: string): string {
  if (nodes.length === 0) return '';
  if (selectedId && nodes.some((ns) => ns.node.id === selectedId)) return selectedId;
  return nodes[0]?.node.id ?? '';
}

export function getMetricValues(
  points: FarmMetricChartPoint[],
  dataKey: keyof FarmMetricChartPoint,
): number[] {
  return points.map((point) => point[dataKey] as number).filter((value) => Number.isFinite(value));
}

export function buildMetricChartData(
  points: FarmMetricChartPoint[],
  dataKey: keyof FarmMetricChartPoint,
) {
  // null = celah di grafik untuk jam yang metriknya kosong.
  return points.map((point) => {
    const value = Number(point[dataKey]);
    return { label: point.label, value: Number.isFinite(value) ? value : null };
  });
}

export function buildNodeHistoricalDataMap(
  nodes: NodeSummary[],
  readingsByNode: Record<string, Reading[]>,
  now: number,
  locale: string,
): Record<string, FarmMetricChartPoint[]> {
  const nodeDataMap: Record<string, FarmMetricChartPoint[]> = {};
  nodes.forEach((ns) => {
    nodeDataMap[ns.node.id] = buildSlotMetricPoints(readingsByNode[ns.node.id] ?? [], now, locale);
  });
  return nodeDataMap;
}

export function buildWeatherForecastViewModel(
  weather: Weather,
  t: TFunction,
  locale: string,
): WeatherForecastViewModel {
  const currentInfo = getWeatherCodeInfo(weather.code, weather.condition);
  const fetchedAt = weather.is_stale === true ? parseServerDate(weather.fetched_at) : null;
  const staleSince = fetchedAt ? formatClockTime(fetchedAt, locale) : null;
  const slots = dropPastForecast(weather.forecast ?? [])
    .slice(0, FORECAST_CARD_SLOTS)
    .map((point, index) => {
      const info = getWeatherCodeInfo(point.weather, point.weather_desc);
      const temp = pickNumber(point.t);

      return {
        key: index,
        time: formatForecastLabel(point, index, t, locale),
        iconKey: info.iconKey,
        labelKey: info.label,
        temp: temp != null ? `${Math.round(temp)}${DEG_C}` : EMPTY_VALUE,
        isRain: info.isRain,
      };
    });

  return {
    currentIconKey: currentInfo.iconKey,
    currentLabelKey: currentInfo.label,
    currentTemperature: formatRounded(weather.temperature, DEG_C),
    currentHumidity: formatPercent(weather.humidity),
    rainNext3h: weather.rain_next_3h === true,
    slots,
    staleSince,
  };
}
