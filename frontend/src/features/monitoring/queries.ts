import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MOCK_READINGS } from '@/lib/mockFarmData';

export function useReadings(nodeId: string, limit = 20) {
  return useQuery({
    queryKey: ['readings', nodeId, limit],
    queryFn: () => {
      if (nodeId.startsWith('mock-node-')) {
        return Promise.resolve({ items: MOCK_READINGS[nodeId] ?? [] });
      }
      return api.getReadings(nodeId, limit);
    },
    enabled: !!nodeId, // jangan fetch kalau belum ada node terpilih
    refetchInterval: 30_000, // auto-refresh tiap 30 detik
  });
}
