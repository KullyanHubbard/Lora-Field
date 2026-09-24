import {
  getHistoricalDataForNode,
  type FarmMetricChartPoint,
} from '@/features/dashboard/dashboardHistoricalData';
import { batteryTone } from '@/lib/status';
import type { TFunction } from 'i18next';
import { DEG_C, EMPTY_VALUE } from '@/lib/format';
import {
  formatForecastLabel,
  getWeatherCodeInfo,
  pickNumber,
  type WeatherIconKey,
} from '@/features/weather/weatherHelpers';
import type { NodeSummary, SemanticTone, Weather } from '@/types';

type NumberStats = {
  min: number;
  max: number;
  avg: number;
};

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

export function buildValveSummary(nodes: NodeSummary[]): ValveSummary {
  const bars = nodes.map((ns) => {
    if (ns.node.status === 'offline') return 'bg-red-500';
    return ns.decision?.valve_state === 'open' ? 'bg-emerald-500' : 'bg-amber-500';
  });

  const totalCount = nodes.length;
  const openCount = bars.filter((className) => className === 'bg-emerald-500').length;
  const offlineCount = bars.filter((className) => className === 'bg-red-500').length;
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
      : pct < 20
        ? 'dashboard.batteryLow'
        : pct <= 50
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
  return points.map((point) => ({ label: point.label, value: Number(point[dataKey]) }));
}

export function buildNodeHistoricalDataMap(nodes: NodeSummary[]): Record<string, FarmMetricChartPoint[]> {
  const nodeDataMap: Record<string, FarmMetricChartPoint[]> = {};
  nodes.forEach((ns) => {
    nodeDataMap[ns.node.id] = getHistoricalDataForNode(ns.node.id);
  });
  return nodeDataMap;
}

export function buildWeatherForecastViewModel(
  weather: Weather,
  t: TFunction,
  locale: string,
): WeatherForecastViewModel {
  const currentInfo = getWeatherCodeInfo(weather.code, weather.condition);
  const slots = (weather.forecast ?? []).slice(0, 6).map((point, index) => {
    const info = getWeatherCodeInfo(
      point.weather,
      point.weather_desc,
    );
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
  };
}
