import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { generateMockIrrigationLogs } from '@/mocks/mockFarmScenario';
import type { FarmSummary } from '@/types';

// Endpoint GET /api/logs mengembalikan semua log; filter per-farm dilakukan
// client-side (sesuai kode lama). farmId hanya menggating query, tidak dikirim
// ke endpoint.
// TODO (future): GET /api/logs belum dukung filter tanggal server-side (hanya ?limit). Tambah param ?start=&end= di backend untuk rentang penuh.
export function useLogs(
  farmId?: string,
  limit = 100,
  mockNodes: FarmSummary['nodes'] = [],
  mockThresholds?: FarmSummary['thresholds'],
) {
  const mockNodeKey = mockNodes
    .map(({ node }) => [node.id, node.name, node.location].join(':'))
    .join('|');

  return useQuery({
    queryKey: ['logs', farmId, limit, mockNodeKey, mockThresholds?.lower, mockThresholds?.upper],
    queryFn: async () => {
      const data = await api.getLogs(limit);
      if (data.items.length > 0) return data;

      return {
        ...data,
        items: generateMockIrrigationLogs({
          nodes: mockNodes.map((nodeSummary) => nodeSummary.node),
          thresholds: mockThresholds,
        }),
      };
    },
    enabled: !!farmId,
    refetchInterval: 30_000, // auto-refresh tiap 30 detik
  });
}
