import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { CreateFarmPayload } from '@/types';

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
      navigate('/select-farms', { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal menambah kebun.');
    },
  });
}
