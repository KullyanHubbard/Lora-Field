import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MOCK_ACTIVE_NODE_COUNT, generateMockGatewayLogs } from '@/mocks/mockFarmScenario';

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
