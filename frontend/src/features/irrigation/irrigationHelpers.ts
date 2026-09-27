import type { FarmSummary, NodeSummary } from '@/types';
import { EMPTY_VALUE, parseServerDate } from '@/lib/format';
import { ACCENT_BG } from '@/lib/toneClasses';

export type IrrigationStats = {
  totalNodes: number;
  openValves: number;
  closedValves: number;
  avgMoisture: number | null;
  belowThresholdNodes: number;
  driestNodes: NodeSummary[];
};

export function formatSyncTime(value: string | null | undefined, locale: string) {
  const d = parseServerDate(value);
  if (!d) return EMPTY_VALUE;

  return d.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function moistureCondition(value: number | null, lower: number, upper: number) {
  if (value == null)
    return { labelKey: 'irrigation.waitingData', tone: 'neutral' as const, bar: 'bg-muted' };
  if (value < lower * 0.75) {
    return { labelKey: 'irrigation.condition.critical', tone: 'red' as const, bar: ACCENT_BG.red };
  }
  if (value < lower)
    return { labelKey: 'irrigation.condition.dry', tone: 'yellow' as const, bar: ACCENT_BG.amber };
  if (value > upper)
    return { labelKey: 'irrigation.condition.wet', tone: 'yellow' as const, bar: ACCENT_BG.sky };
  return {
    labelKey: 'irrigation.condition.normal',
    tone: 'green' as const,
    bar: ACCENT_BG.emerald,
  };
}

export type IrrigationActivity =
  'active' | 'standby' | 'delayed' | 'offline' | 'initializing' | 'notConfigured';

export const IRRIGATION_ACTIVITY_LABEL_KEYS: Record<IrrigationActivity, string> = {
  active: 'irrigation.activity.active',
  standby: 'irrigation.activity.standby',
  delayed: 'irrigation.activity.delayed',
  offline: 'irrigation.activity.offline',
  initializing: 'irrigation.activity.initializing',
  notConfigured: 'irrigation.activity.notConfigured',
};

// Kondisi pengairan kebun untuk kepala halaman Irigasi. Kalau beberapa kondisi terjadi
// bersamaan, urutan pengecekan di bawah adalah prioritasnya.
export function getIrrigationActivity(nodes: NodeSummary[]): IrrigationActivity {
  if (nodes.length === 0) return 'notConfigured';
  if (nodes.every((ns) => ns.node.status === 'offline')) return 'offline';
  if (nodes.every((ns) => ns.latest_reading == null)) return 'initializing';
  if (nodes.some((ns) => ns.decision?.valve_state === 'open' || ns.decision?.type === 'soaking')) {
    return 'active';
  }
  if (nodes.some((ns) => ns.decision?.type === 'delayed')) return 'delayed';
  return 'standby';
}

export function getNodeMoisture(ns: NodeSummary) {
  return ns.latest_reading?.soil_moisture ?? null;
}

export function valveKeyFromDecision(decision: NodeSummary['decision'] | null | undefined): string {
  if (!decision) return 'valve.unknown';
  if (decision.valve_state === 'open') return 'valve.open';
  if (decision.valve_state === 'closed') return 'valve.closed';
  return 'valve.unknown';
}

export function buildIrrigationStats(summary: FarmSummary, nodes: NodeSummary[]): IrrigationStats {
  const totalNodes = nodes.length;
  const valveKeys = nodes.map((ns) => valveKeyFromDecision(ns.decision));
  const openValves = valveKeys.filter((key) => key === 'valve.open').length;
  const closedValves = valveKeys.filter((key) => key === 'valve.closed').length;
  const moistures = nodes.map(getNodeMoisture).filter((value): value is number => value != null);
  const avgMoisture = moistures.length
    ? moistures.reduce((total, value) => total + value, 0) / moistures.length
    : null;
  const belowThresholdNodes = nodes.filter((ns) => {
    const moisture = getNodeMoisture(ns);
    return moisture != null && moisture < summary.thresholds.lower;
  }).length;
  const driestNodes = [...nodes]
    .filter((ns) => getNodeMoisture(ns) != null)
    .sort((a, b) => (getNodeMoisture(a) ?? 0) - (getNodeMoisture(b) ?? 0))
    .slice(0, 3);

  return { totalNodes, openValves, closedValves, avgMoisture, belowThresholdNodes, driestNodes };
}
