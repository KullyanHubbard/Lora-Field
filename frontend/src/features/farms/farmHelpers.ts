// Domain logic agregasi farm summary — diport dari frontend React lama (utils/farmHelpers.js)
// (valveKeyFromDecision, getFarmLastUpdate). Murni, tanpa side effect.
import type { Farm, NodeSummary } from '@/types';

export type FarmStatusTone = 'green' | 'yellow' | 'red' | 'neutral';

// Mapping status kebun -> tone lampu. SATU sumber kebenaran tone (dipakai
// SelectFarms dan halaman Kebun Saya/MyFarmsPage). active=hijau;
// warning/maintenance=kuning; inactive/offline=merah; sisanya neutral.
export function farmStatusTone(status: string): FarmStatusTone {
  switch (status) {
    case 'active':
      return 'green';
    case 'warning':
    case 'maintenance':
      return 'yellow';
    case 'inactive':
    case 'offline':
      return 'red';
    default:
      return 'neutral';
  }
}

// Mapping status kebun -> labelKey i18n (untuk teks screen reader).
export function farmStatusLabelKey(status: string): string {
  switch (status) {
    case 'active':
      return 'farmStatus.active';
    case 'warning':
      return 'farmStatus.warning';
    case 'maintenance':
      return 'farmStatus.maintenance';
    case 'inactive':
    case 'offline':
      return 'farmStatus.inactive';
    default:
      return 'farmStatus.unknown';
  }
}

export function valveKeyFromDecision(
  decision: NodeSummary['decision'] | null | undefined,
): string {
  if (!decision) return 'valve.unknown';
  return decision.valve_state === 'open' ? 'valve.open' : 'valve.closed';
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
