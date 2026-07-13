import { useQuery } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { generateMockReadingsForNode } from '@/mocks/mockFarmScenario';

function mockReadingResponse(nodeId: string, limit: number) {
  return { items: generateMockReadingsForNode(nodeId, limit) };
}

export function useReadings(nodeId: string, limit = 100) {
  return useQuery({
    queryKey: ['readings', nodeId, limit],
    queryFn: async () => {
      try {
        const response = await api.getReadings(nodeId, limit);
        return response.items.length > 0 ? response : mockReadingResponse(nodeId, limit);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return mockReadingResponse(nodeId, limit);
        }
        throw error;
      }
    },
    enabled: !!nodeId,
    refetchInterval: 30_000,
  });
}
