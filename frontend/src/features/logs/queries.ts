import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Endpoint GET /api/logs mengembalikan semua log; filter per-farm dilakukan
// client-side (sesuai kode lama). farmId hanya menggating query, tidak dikirim
// ke endpoint.
export function useLogs(farmId?: string, limit = 100) {
  return useQuery({
    queryKey: ['logs', limit],
    queryFn: () => api.getLogs(limit),
    enabled: !!farmId,
    refetchInterval: 30_000, // auto-refresh tiap 30 detik
  });
}
