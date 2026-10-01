import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
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

export function useRequestGatewayWifiPortal(farmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.requestGatewayWifiPortal(farmId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm-summary', farmId] });
      queryClient.invalidateQueries({ queryKey: ['gateway-logs', farmId] });
      toast.success(i18n.t('gateway.changeWifiSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('gateway.changeWifiError'));
    },
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
