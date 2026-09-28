import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFarmSummary } from '@/features/dashboard/queries';
import i18n from '@/i18n/config';
import { api } from '@/lib/api';

export function useIrrigationSummary(farmId?: string) {
  return useFarmSummary(farmId ?? '');
}

export function useRenameNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, name }: { nodeId: string; name: string }) =>
      api.updateNodeName(nodeId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm-summary'] });
      toast.success(i18n.t('irrigation.renameSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('irrigation.renameError'));
    },
  });
}
