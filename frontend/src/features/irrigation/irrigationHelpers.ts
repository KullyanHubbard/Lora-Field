import type { FarmSummary, NodeSummary } from '@/types';

export type IrrigationStats = {
  totalNodes: number;
  openValves: number;
  closedValves: number;
  avgMoisture: number | null;
  belowThresholdNodes: number;
  driestNodes: NodeSummary[];
};

export function formatSyncTime(value: string | null | undefined, locale: string) {
  if (!value) return '—';

  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';

  return d.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function moistureCondition(value: number | null, lower: number, upper: number) {
  if (value == null) return { labelKey: 'irrigation.waitingData', tone: 'neutral' as const, bar: 'bg-muted' };
  if (value < lower * 0.75) {
    return { labelKey: 'irrigation.condition.critical', tone: 'red' as const, bar: 'bg-red-500' };
  }
  if (value < lower) return { labelKey: 'irrigation.condition.dry', tone: 'yellow' as const, bar: 'bg-amber-500' };
  if (value > upper) return { labelKey: 'irrigation.condition.wet', tone: 'yellow' as const, bar: 'bg-sky-500' };
  return { labelKey: 'irrigation.condition.normal', tone: 'green' as const, bar: 'bg-emerald-500' };
}

export function getNodeMoisture(ns: NodeSummary) {
  return ns.latest_reading?.soil_moisture ?? null;
}

export function valveKeyFromDecision(
  decision: NodeSummary['decision'] | null | undefined,
): string {
  if (!decision) return 'valve.unknown';
  return decision.valve_state === 'open' ? 'valve.open' : 'valve.closed';
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
