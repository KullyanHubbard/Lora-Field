import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Farm } from '@/types';

export function useDeleteFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteFarm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      toast.success('Kebun berhasil dihapus.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal menghapus kebun.');
    },
  });
}

export function useUpdateFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Farm> }) =>
      api.updateFarm(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      toast.success('Kebun berhasil diperbarui.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal memperbarui kebun.');
    },
  });
}
