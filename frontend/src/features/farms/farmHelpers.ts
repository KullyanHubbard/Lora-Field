// Domain logic agregasi farm summary — diport dari frontend React lama (utils/farmHelpers.js)
// (valveLabelFromDecision, getFarmLastUpdate). Murni, tanpa side effect.
import type { Farm, NodeSummary } from '@/types';

export function valveLabelFromDecision(
  decision: NodeSummary['decision'] | null | undefined,
): string {
  if (!decision) return 'Tidak diketahui';
  return decision.valve_state === 'open' ? 'Terbuka' : 'Tertutup';
}

/**
 * Ambil timestamp update paling baru dari farm + readings semua node.
 * Return string ISO | null.
 */
export function getFarmLastUpdate(farm: Farm, nodeSummaries: NodeSummary[] = []): string | null {
  const candidates: string[] = [];
  if (farm?.updated_at) candidates.push(farm.updated_at);
  for (const ns of nodeSummaries) {
    if (ns.node?.updated_at) candidates.push(ns.node.updated_at);
    if (ns.latest_reading?.created_at) candidates.push(ns.latest_reading.created_at);
  }
  if (!candidates.length) return null;
  return candidates.reduce((latest, current) => {
    const a = new Date(current).getTime();
    const b = new Date(latest).getTime();
    if (!Number.isFinite(a)) return latest;
    if (!Number.isFinite(b)) return current;
    return a > b ? current : latest;
  }, candidates[0]);
}
