import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useGatewayLogs(farmId?: string, limit = 20) {
  return useQuery({
    queryKey: ['gateway-logs', farmId, limit],
    queryFn: () => api.getGatewayLogs(farmId ?? '', limit),
    enabled: !!farmId,
  });
}

export function useFarmGateway(farmId?: string) {
  return useQuery({
    queryKey: ['farm-gateway', farmId],
    queryFn: () => api.getFarmGateway(farmId ?? ''),
    enabled: !!farmId,
  });
}
