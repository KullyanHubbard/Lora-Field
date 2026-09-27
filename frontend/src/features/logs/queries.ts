import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LIVE_DATA_INTERVAL_MS } from '@/lib/queryTiming';

// Endpoint GET /api/logs mengembalikan semua log; filter per-farm dilakukan
// client-side (sesuai kode lama). farmId hanya menggating query, tidak dikirim
// ke endpoint.
// TODO (future): GET /api/logs belum dukung filter tanggal server-side (hanya ?limit). Tambah param ?start=&end= di backend untuk rentang penuh.
// Batas maksimum GET /api/logs di backend.
const LOGS_FETCH_LIMIT = 100;

export function useLogs(farmId?: string) {
  return useQuery({
    queryKey: ['logs', farmId, LOGS_FETCH_LIMIT],
    queryFn: () => api.getLogs(LOGS_FETCH_LIMIT),
    enabled: !!farmId,
    refetchInterval: LIVE_DATA_INTERVAL_MS,
  });
}
