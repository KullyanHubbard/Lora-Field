import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { GatewayClaimPayload } from '@/types';

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

export function useClaimFarmGateway(farmId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GatewayClaimPayload) => api.claimFarmGateway(farmId ?? '', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm-gateway', farmId] });
      queryClient.invalidateQueries({ queryKey: ['farm-summary', farmId] });
      queryClient.invalidateQueries({ queryKey: ['gateway-logs'] });
      toast.success('Gateway berhasil dihubungkan.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal menghubungkan gateway.');
    },
  });
}

export function useUnclaimFarmGateway(farmId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.unclaimFarmGateway(farmId ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm-gateway', farmId] });
      queryClient.invalidateQueries({ queryKey: ['farm-summary', farmId] });
      queryClient.invalidateQueries({ queryKey: ['gateway-logs'] });
      toast.success('Gateway berhasil dilepas.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal melepas gateway.');
    },
  });
}
