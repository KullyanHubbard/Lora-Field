import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Log koneksi gateway. Endpoint kemungkinan besar balas { items: [] } sampai
// hardware gateway melapor via POST. Tidak ada fallback mock — empty state jujur.
export function useGatewayLogs(farmId?: string, limit = 20) {
  return useQuery({
    queryKey: ['gateway-logs', farmId, limit],
    queryFn: () => api.getGatewayLogs(farmId ?? '', limit),
    enabled: !!farmId,
  });
}
