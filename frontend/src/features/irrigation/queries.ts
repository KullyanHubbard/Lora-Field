import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { withMockNodeFallback } from '@/lib/mockFarmData';

export function useIrrigationSummary(farmId?: string) {
  const resolvedFarmId = farmId ?? '';

  return useQuery({
    queryKey: ['farm-summary', resolvedFarmId],
    queryFn: () => api.getFarmSummary(resolvedFarmId),
    enabled: !!resolvedFarmId,
    refetchInterval: 30_000,
    select: withMockNodeFallback,
  });
}
