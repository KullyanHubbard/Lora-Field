import { useFarmSummary } from '@/features/dashboard/queries';

export function useIrrigationSummary(farmId?: string) {
  return useFarmSummary(farmId ?? '');
}
