// Domain logic agregasi farm summary, diport dari frontend React lama (utils/farmStatusHelpers.js).
// Murni, tanpa side effect.
import { parseServerDate } from '@/lib/format';
import type { Farm, NodeSummary } from '@/types';

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
    const a = parseServerDate(current);
    const b = parseServerDate(latest);
    if (!a) return latest;
    if (!b) return current;
    return a > b ? current : latest;
  }, candidates[0]);
}
