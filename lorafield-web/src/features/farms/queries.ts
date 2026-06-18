import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useFarms() {
  return useQuery({
    queryKey: ['farms'],
    queryFn: () => api.getFarms(),
  });
}

export function useFarmSummary(farmId: string) {
  return useQuery({
    queryKey: ['farm-summary', farmId],
    queryFn: () => api.getFarmSummary(farmId),
    enabled: !!farmId, // jangan fetch kalau farmId kosong
    refetchInterval: 30_000, // auto-refresh tiap 30 detik
  });
}
