import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LIVE_DATA_INTERVAL_MS } from '@/lib/queryTiming';
import { READINGS_FETCH_HOURS } from '@/lib/timeWindows';

export function useReadings(nodeId: string) {
  return useQuery({
    queryKey: ['readings', nodeId, READINGS_FETCH_HOURS],
    queryFn: () => api.getReadings(nodeId, READINGS_FETCH_HOURS),
    enabled: !!nodeId,
    refetchInterval: LIVE_DATA_INTERVAL_MS,
  });
}
