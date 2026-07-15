import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { MOCK_ACTIVE_NODE_COUNT, generateMockGatewayLogs } from '@/mocks/mockFarmScenario';
import type { GatewayClaimPayload } from '@/types';

// Log koneksi gateway. Saat hardware belum mengirim data, tampilkan mock agar
// dashboard tetap terisi selama fase demo/development.
export function useGatewayLogs(
  farmId?: string,
  limit = 20,
  activeNodeCount = MOCK_ACTIVE_NODE_COUNT,
) {
  return useQuery({
    queryKey: ['gateway-logs', farmId, limit, activeNodeCount],
    queryFn: async () => {
      const response = await api.getGatewayLogs(farmId ?? '', limit);
      if (response.items.length > 0) return response;

      const mockLogs = generateMockGatewayLogs({
        farmId,
        activeNodeCount,
      });

      return {
        ...response,
        items: mockLogs.slice(0, limit),
        total: mockLogs.length,
      };
    },
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
