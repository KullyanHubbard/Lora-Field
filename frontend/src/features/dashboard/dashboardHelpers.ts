import {
  getHistoricalDataForNode,
  type FarmMetricChartPoint,
} from '@/features/dashboard/dashboardHistoricalData';
import { batteryTone } from '@/lib/status';
import { DEG_C } from '@/lib/format';
import { getWeatherCodeInfo, pickNumber, type WeatherIconKey } from '@/features/weather/weatherHelpers';
import type { GatewayLog, NodeSummary, Weather, WeatherForecastPoint } from '@/types';

export const DASH = '—';

export type NumberStats = {
  min: number;
  max: number;
  avg: number;
};

export type BatteryGaugeTone = 'green' | 'yellow' | 'red' | 'neutral';

export type ValveSummary = {
  bars: string[];
  totalCount: number;
  openCount: number;
  closedCount: number;
  offlineCount: number;
};

export type BatteryGaugeModel = {
  pct: number | null;
  tone: BatteryGaugeTone;
  centerLabel: string;
  centerSubKey?: string;
};

export type WeatherForecastSlot = {
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

export type GatewayLogMeta = {
  labelKey: string;
  dotClassName: string;
};

export function toFiniteNumber(value: number | null | undefined): number | null {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function formatRounded(value: number | null | undefined, suffix = ''): string {
  const numeric = toFiniteNumber(value);
  return numeric == null ? DASH : `${Math.round(numeric)}${suffix}`;
}

export function formatPercent(value: number | null | undefined): string {
  const numeric = toFiniteNumber(value);
  return numeric == null ? DASH : `${clampPercent(numeric)}%`;
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
  const tone: BatteryGaugeTone = pct != null ? (batteryTone(pct) as BatteryGaugeTone) : 'neutral';
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
    centerLabel: pct != null ? `${pct}%` : DASH,
    centerSubKey,
  };
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

export function forecastSlotTime(point: WeatherForecastPoint, index: number): string {
  const raw = point.local_datetime || point.datetime || point.utc_datetime;
  if (!raw) return index === 0 ? DASH : `+${index * 3}j`;

  const normalized = String(raw).replace(' ', 'T');
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  const timePart = String(raw).split(/[ T]/)[1];
  return timePart ? timePart.slice(0, 5) : DASH;
}

export function buildWeatherForecastViewModel(weather: Weather): WeatherForecastViewModel {
  const currentInfo = getWeatherCodeInfo(weather.code, weather.condition);
  const slots = (weather.forecast ?? []).slice(0, 6).map((point, index) => {
    const info = getWeatherCodeInfo(
      point.weather ?? point.code,
      point.weather_desc ?? point.condition,
    );
    const temp = pickNumber(point.t, point.temperature);

    return {
      key: index,
      time: forecastSlotTime(point, index),
      iconKey: info.iconKey,
      labelKey: info.label,
      temp: temp != null ? `${Math.round(temp)}${DEG_C}` : DASH,
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

// TODO: Keterangan di sini nantinya akan di-generate oleh Decision Engine.
// Pastikan saat membuat Decision Engine, output teksnya harus mengikuti bahasa (locale) yang sedang aktif di aplikasi.
export function getGatewayLogMeta(log: GatewayLog): GatewayLogMeta {
  const labelKeyByEvent: Record<string, string> = {
    connected: 'gateway.filterConnected',
    disconnected: 'gateway.filterDisconnected',
    heartbeat: 'gateway.filterHeartbeat',
    data_sync: 'gateway.filterDataSync',
  };

  const dotByEvent: Record<string, string> = {
    connected: 'bg-emerald-500',
    disconnected: 'bg-red-500',
    heartbeat: 'bg-blue-500',
    data_sync: 'bg-violet-500',
  };

  return {
    labelKey: labelKeyByEvent[log.event] ?? `gateway.filter${log.event.charAt(0).toUpperCase() + log.event.slice(1)}`,
    dotClassName: dotByEvent[log.event] ?? 'bg-muted-foreground',
  };
}
