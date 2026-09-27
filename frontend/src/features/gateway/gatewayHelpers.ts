import { getGatewayStatusBadge } from '@/lib/status';
import type { StatusTone } from '@/lib/status';
import { EMPTY_VALUE } from '@/lib/format';
import type { FarmGateway, FarmSummary, GatewayLog } from '@/types';
import { ACCENT_BG } from '@/lib/toneClasses';

const GATEWAY_LOGS_PER_PAGE = 10;
export const GATEWAY_LOGS_FETCH_LIMIT = 20;

export const GATEWAY_EVENT_FILTERS = [
  'all',
  'connected',
  'disconnected',
  'heartbeat',
  'data_sync',
] as const;

export type GatewayEventFilter = (typeof GATEWAY_EVENT_FILTERS)[number];

// Map of event values to their i18n keys
const GATEWAY_EVENT_LABEL_KEYS: Record<string, string> = {
  all: 'gateway.filterAll',
  connected: 'gateway.filterConnected',
  disconnected: 'gateway.filterDisconnected',
  heartbeat: 'gateway.filterHeartbeat',
  data_sync: 'gateway.filterDataSync',
};

export type GatewayInfoViewModel = {
  gatewayId: string;
  displayName: string | null;
  statusLabelKey: string;
  statusTone: StatusTone;
  signalValueKey: string;
  internetValueKey: string;
  lastSeen: string | null;
};

// Status dari summary.gateway_status backend (satu sumber dengan kartu lain), tidak dihitung ulang di sini.
export function buildGatewayInfo(
  gateway: FarmGateway | null | undefined,
  gatewayStatus: FarmSummary['gateway_status'],
): GatewayInfoViewModel {
  const status = getGatewayStatusBadge(gateway ? gatewayStatus : 'offline');

  return {
    gatewayId: gateway?.device_id ?? EMPTY_VALUE,
    displayName: gateway?.display_name ?? null,
    statusLabelKey: status.labelKey,
    statusTone: status.tone,
    signalValueKey: 'gateway.signalNone',
    internetValueKey: 'gateway.internetNotMonitored',
    lastSeen: gateway?.last_seen_at ?? null,
  };
}

export function buildGatewayEventCounts(logs: GatewayLog[]) {
  const counts: Record<string, number> = { all: logs.length };

  for (const log of logs) {
    counts[log.event] = (counts[log.event] ?? 0) + 1;
  }

  return counts;
}

export function filterGatewayLogs(logs: GatewayLog[], filter: GatewayEventFilter) {
  if (filter === 'all') return logs;
  return logs.filter((log) => log.event === filter);
}

export function getGatewayTotalPages(totalItems: number) {
  return Math.max(1, Math.ceil(totalItems / GATEWAY_LOGS_PER_PAGE));
}

export function getGatewaySafePage(page: number, totalPages: number) {
  return Math.min(page, totalPages - 1);
}

export function paginateGatewayLogs(logs: GatewayLog[], page: number) {
  const start = page * GATEWAY_LOGS_PER_PAGE;
  return logs.slice(start, start + GATEWAY_LOGS_PER_PAGE);
}

// Returns i18n key for gateway event label
export function getGatewayEventLabelKey(event: string): string {
  return (
    GATEWAY_EVENT_LABEL_KEYS[event] ??
    `gateway.filter${event.charAt(0).toUpperCase() + event.slice(1)}`
  );
}

// Detail heartbeat dikirim gateway sebagai "<terdengar>/<total> node" (lihat simulator/lorafield_sim.py).
// Format lain menghasilkan null supaya teks aslinya tetap tampil.
export function parseHeartbeatNodeCount(log: GatewayLog) {
  if (log.event !== 'heartbeat') return null;
  const match = /^(\d+)\/(\d+) node$/.exec(log.detail.trim());
  if (!match) return null;
  return { heard: Number(match[1]), total: Number(match[2]) };
}

export function getGatewayEventTone(event: string) {
  if (event === 'connected' || event === 'heartbeat' || event === 'data_sync') return 'green';
  if (event === 'disconnected') return 'red';
  return 'neutral';
}

export function getGatewayEventDotClass(event: string) {
  const map: Record<string, string> = {
    connected: ACCENT_BG.emerald,
    disconnected: ACCENT_BG.red,
    heartbeat: ACCENT_BG.blue,
    data_sync: ACCENT_BG.violet,
  };

  return map[event] ?? 'bg-muted-foreground';
}
