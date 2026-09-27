import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LIVE_DATA_INTERVAL_MS } from '@/lib/queryTiming';

// Filter kebun dan rentang tanggal dikerjakan backend. Tanpa filter tanggal: 100 log
// terbaru, ikut diperbarui berkala. Dengan filter tanggal: sampai 1000 log (batas
// backend), tanpa refresh berkala karena riwayat lama tidak berubah dan 1000 baris
// terlalu besar untuk diambil tiap 30 detik.
export const LOGS_LIVE_LIMIT = 100;
export const LOGS_RANGE_LIMIT = 1000;

export function logsLimit(range: { start?: string; end?: string }): number {
  return range.start || range.end ? LOGS_RANGE_LIMIT : LOGS_LIVE_LIMIT;
}

export function useLogs(farmId: string | undefined, range: { start?: string; end?: string }) {
  const limit = logsLimit(range);
  return useQuery({
    queryKey: ['logs', farmId, range.start, range.end, limit],
    queryFn: () => api.getLogs({ farmId: farmId ?? '', limit, ...range }),
    enabled: !!farmId,
    refetchInterval: limit === LOGS_LIVE_LIMIT ? LIVE_DATA_INTERVAL_MS : false,
    placeholderData: keepPreviousData,
  });
}
