import { useQuery } from '@tanstack/react-query';
import { readingsQuery } from '@/features/dashboard/queries';

export function useReadings(nodeId: string) {
  return useQuery({ ...readingsQuery(nodeId), enabled: !!nodeId });
}
