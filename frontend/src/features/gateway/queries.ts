import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LIVE_DATA_INTERVAL_MS } from '@/lib/queryTiming';

export function useGatewayLogs(farmId: string | undefined, limit: number) {
  return useQuery({
    queryKey: ['gateway-logs', farmId, limit],
    queryFn: () => api.getGatewayLogs(farmId ?? '', limit),
    enabled: !!farmId,
    refetchInterval: LIVE_DATA_INTERVAL_MS,
  });
}

export function useFarmGateway(farmId?: string) {
  return useQuery({
    queryKey: ['farm-gateway', farmId],
    queryFn: () => api.getFarmGateway(farmId ?? ''),
    enabled: !!farmId,
    refetchInterval: LIVE_DATA_INTERVAL_MS,
  });
}
