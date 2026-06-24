import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { mockNodeSummaries } from '@/lib/mockFarmData';
import type { CreateFarmPayload, FarmSummary } from '@/types';

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
    select: (summary: FarmSummary): FarmSummary => {
      if (summary.nodes.length === 0) {
        const mockNodes = mockNodeSummaries();
        const mockMoistures = mockNodes.map((ns) => ns.latest_reading.soil_moisture);
        const avgMock = Math.round(mockMoistures.reduce((a, b) => a + b, 0) / mockMoistures.length);
        return {
          ...summary,
          nodes: mockNodes,
          is_mock_data: true,
          gateway_status: 'online',
          average_soil_moisture: avgMock,
          nodes_problem: 0,
          // weather WAJIB tetap dari summary asli, tidak diubah
        };
      }
      return { ...summary, is_mock_data: false };
    },
  });
}

export function useCrops(q?: string) {
  return useQuery({
    queryKey: ['crops', q ?? ''],
    queryFn: () => api.getCrops(q ?? ''),
    staleTime: 5 * 60_000, // daftar tanaman jarang berubah
  });
}

export function useCreateFarm() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (payload: CreateFarmPayload) => api.createFarm(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      toast.success('Kebun berhasil ditambahkan.');
      navigate('/dashboard', { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal menambah kebun.');
    },
  });
}

export function useUpdateFarm(farmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CreateFarmPayload>) => api.updateFarm(farmId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      queryClient.invalidateQueries({ queryKey: ['farm-summary', farmId] });
      toast.success('Perubahan kebun berhasil disimpan.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal memperbarui kebun.');
    },
  });
}
