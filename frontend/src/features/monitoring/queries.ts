import { useQuery } from '@tanstack/react-query';
import { generateMockReadings } from './mockReadings';

export function useReadings(nodeId: string, limit = 100) {
  return useQuery({
    queryKey: ['readings', nodeId, limit],
    queryFn: () => Promise.resolve({ items: generateMockReadings(nodeId) }),
    enabled: !!nodeId,
    refetchInterval: 30_000,
  });
}
