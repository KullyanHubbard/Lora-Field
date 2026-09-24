import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { api } from '@/lib/api';
import type { UpdateFarmPayload } from '@/types';

export function useDeleteFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteFarm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      toast.success(i18n.t('myFarms.toastDeleteSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('myFarms.toastDeleteError'));
    },
  });
}

export function useUpdateFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateFarmPayload }) =>
      api.updateFarm(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      toast.success(i18n.t('myFarms.toastUpdateSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('myFarms.toastUpdateError'));
    },
  });
}
