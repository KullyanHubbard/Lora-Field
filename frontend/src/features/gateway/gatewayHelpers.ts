import { getOnlineStatusBadge } from '@/lib/status';
import type { StatusTone } from '@/lib/status';
import { EMPTY_VALUE } from '@/lib/format';
import type { FarmGateway, FarmSummary, GatewayLog } from '@/types';
import { ACCENT_BG } from '@/lib/toneClasses';

const GATEWAY_LOGS_PER_PAGE = 10;
export const GATEWAY_LOGS_FETCH_LIMIT = 20;

// Heartbeat tidak dicatat lagi sejak 2026-10-02 (entri lama tetap tampil di Semua), jadi tidak punya filter.
export const GATEWAY_EVENT_FILTERS = ['all', 'connected', 'disconnected', 'restarted'] as const;

export type GatewayEventFilter = (typeof GATEWAY_EVENT_FILTERS)[number];

const GATEWAY_EVENT_LABEL_KEYS: Record<string, string> = {
  all: 'gateway.filterAll',
  connected: 'gateway.filterConnected',
  disconnected: 'gateway.filterDisconnected',
  heartbeat: 'gateway.filterHeartbeat',
  restarted: 'gateway.filterRestarted',
  wifi_portal: 'gateway.eventWifiPortal',
};

export type GatewayInfoViewModel = {
  gatewayId: string;
  displayName: string | null;
  statusLabelKey: string;
  statusTone: StatusTone;
  wifiSsid: string | null;
  wifiRssi: number | null;
  lastSeen: string | null;
  isOnline: boolean;
  // Hotspot portal WiFi gateway: "LoraField-" + 4 karakter terakhir ID (sama dengan firmware dan stiker).
  portalSsid: string | null;
};

// Status dari summary.gateway_status backend (satu sumber dengan kartu lain), tidak dihitung ulang di sini.
export function buildGatewayInfo(
  gateway: FarmGateway | null | undefined,
  gatewayStatus: FarmSummary['gateway_status'],
): GatewayInfoViewModel {
  const status = getOnlineStatusBadge(gateway ? gatewayStatus : 'offline');

  return {
    gatewayId: gateway?.device_id ?? EMPTY_VALUE,
    displayName: gateway?.display_name ?? null,
    statusLabelKey: status.labelKey,
    statusTone: status.tone,
    wifiSsid: gateway?.wifi_ssid ?? null,
    wifiRssi: gateway?.wifi_rssi ?? null,
    lastSeen: gateway?.last_seen_at ?? null,
    isOnline: !!gateway && gatewayStatus === 'online',
    portalSsid: gateway ? `LoraField-${gateway.device_id.slice(-4)}` : null,
  };
}

// Mutu sinyal WiFi gateway ke router (dBm, makin mendekati 0 makin kuat).
export function getWifiSignalLabelKey(rssi: number): string {
  if (rssi >= -60) return 'gateway.signalStrong';
  if (rssi >= -70) return 'gateway.signalMedium';
  return 'gateway.signalWeak';
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

export function getGatewayEventLabelKey(event: string): string {
  return (
    GATEWAY_EVENT_LABEL_KEYS[event] ??
    `gateway.filter${event.charAt(0).toUpperCase() + event.slice(1)}`
  );
}

export function getGatewayEventTone(event: string) {
  if (event === 'connected' || event === 'heartbeat') return 'green';
  if (event === 'disconnected') return 'red';
  return 'neutral';
}

export function getGatewayEventDotClass(event: string) {
  const map: Record<string, string> = {
    connected: ACCENT_BG.emerald,
    disconnected: ACCENT_BG.red,
    heartbeat: ACCENT_BG.blue,
    restarted: ACCENT_BG.amber,
    wifi_portal: ACCENT_BG.amber,
  };

  return map[event] ?? 'bg-muted-foreground';
}
