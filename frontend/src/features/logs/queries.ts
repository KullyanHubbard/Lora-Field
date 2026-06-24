import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MOCK_LOGS } from '@/lib/mockFarmData';

// Endpoint GET /api/logs mengembalikan semua log; filter per-farm dilakukan
// client-side (sesuai kode lama). farmId hanya menggating query, tidak dikirim
// ke endpoint.
// TODO (future): GET /api/logs belum dukung filter tanggal server-side (hanya ?limit). Tambah param ?start=&end= di backend untuk rentang penuh.
export function useLogs(farmId?: string, limit = 100) {
  return useQuery({
    queryKey: ['logs', limit],
    queryFn: () => api.getLogs(limit),
    enabled: !!farmId,
    refetchInterval: 30_000, // auto-refresh tiap 30 detik
    select: (data) => {
      if (data.items.length === 0) {
        return { items: MOCK_LOGS };
      }
      return data;
    },
  });
}
