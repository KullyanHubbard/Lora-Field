import { useFarmSummary } from '@/features/farms/queries';

export function useIrrigationSummary(farmId?: string) {
  return useFarmSummary(farmId ?? '');
}
