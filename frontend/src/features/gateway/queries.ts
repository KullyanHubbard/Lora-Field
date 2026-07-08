import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MOCK_GATEWAY_LOGS } from '@/mocks/mockGatewayLogs';

// Log koneksi gateway. Saat hardware belum mengirim data, tampilkan mock agar
// ringkasan kebun tetap terisi selama fase demo/development.
export function useGatewayLogs(farmId?: string, limit = 20) {
  return useQuery({
    queryKey: ['gateway-logs', farmId, limit],
    queryFn: () => api.getGatewayLogs(farmId ?? '', limit),
    enabled: !!farmId,
    select: (response) => {
      if (response.items.length > 0) return response;

      const items = MOCK_GATEWAY_LOGS.slice(0, limit).map((log) => ({
        ...log,
        farm_id: farmId ?? '',
      }));

      return {
        ...response,
        items,
        total: MOCK_GATEWAY_LOGS.length,
      };
    },
  });
}
