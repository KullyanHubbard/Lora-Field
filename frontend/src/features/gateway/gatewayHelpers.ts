import { getFarmLastUpdate } from '@/features/farms/farmHelpers';
import { getGatewayStatusBadge } from '@/lib/status';
import type { StatusTone } from '@/lib/status';
import type { FarmSummary, GatewayLog } from '@/types';

export const GATEWAY_LOGS_PER_PAGE = 10;

export const GATEWAY_EVENT_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'connected', label: 'Terhubung' },
  { value: 'disconnected', label: 'Terputus' },
  { value: 'heartbeat', label: 'Heartbeat' },
  { value: 'data_sync', label: 'Sinkronisasi' },
] as const;

export type GatewayEventFilter = (typeof GATEWAY_EVENT_OPTIONS)[number]['value'];

export type GatewayInfoViewModel = {
  gatewayId: string;
  statusLabelKey: string;
  statusTone: StatusTone;
  signalValue: string;
  internetValue: string;
  lastSeen: string | null;
};

export function buildGatewayInfo(summary: FarmSummary): GatewayInfoViewModel {
  const status = getGatewayStatusBadge(summary.gateway_status);
  const isOnline = summary.gateway_status === 'online';

  return {
    gatewayId: `gw-${summary.farm.id}`,
    statusLabelKey: status.labelKey,
    statusTone: status.tone,
    signalValue: isOnline ? 'Kuat' : '-',
    internetValue: isOnline ? 'WiFi' : '-',
    lastSeen: getFarmLastUpdate(summary.farm, summary.nodes),
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

export function getGatewayEventLabel(event: string) {
  const option = GATEWAY_EVENT_OPTIONS.find((item) => item.value === event);
  return option?.label ?? event;
}

export function getGatewayEventTone(event: string) {
  if (event === 'connected' || event === 'heartbeat' || event === 'data_sync') return 'green';
  if (event === 'disconnected') return 'red';
  return 'neutral';
}

export function getGatewayEventDotClass(event: string) {
  const map: Record<string, string> = {
    connected: 'bg-emerald-500',
    disconnected: 'bg-red-500',
    heartbeat: 'bg-blue-500',
    data_sync: 'bg-violet-500',
  };

  return map[event] ?? 'bg-muted-foreground';
}
