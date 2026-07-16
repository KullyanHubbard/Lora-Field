import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useReadings(nodeId: string, limit = 100) {
  return useQuery({
    queryKey: ['readings', nodeId, limit],
    queryFn: () => api.getReadings(nodeId, limit),
    enabled: !!nodeId,
    refetchInterval: 30_000,
  });
}
