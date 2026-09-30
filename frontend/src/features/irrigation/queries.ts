import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFarmSummary } from '@/features/dashboard/queries';
import i18n from '@/i18n/config';
import { api } from '@/lib/api';
import type { LimitedIrrigationReason } from '@/types';

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

function useLimitedIrrigationMutation<T>(
  farmId: string,
  mutationFn: (variables: T) => Promise<unknown>,
  successKey: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm-summary', farmId] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      toast.success(i18n.t(successKey));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('limitedIrrigation.error'));
    },
  });
}

export function useStartLimitedIrrigation(farmId: string) {
  return useLimitedIrrigationMutation(
    farmId,
    ({ reason, until }: { reason: LimitedIrrigationReason; until: string }) =>
      api.startLimitedIrrigation(farmId, reason, until),
    'limitedIrrigation.startSuccess',
  );
}

export function useUpdateLimitedIrrigation(farmId: string) {
  return useLimitedIrrigationMutation(
    farmId,
    (until: string) => api.updateLimitedIrrigation(farmId, until),
    'limitedIrrigation.updateSuccess',
  );
}

export function useStopLimitedIrrigation(farmId: string) {
  return useLimitedIrrigationMutation(
    farmId,
    () => api.stopLimitedIrrigation(farmId),
    'limitedIrrigation.stopSuccess',
  );
}

export function useResumeAutoIrrigation(farmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nodeId: string) => api.resumeAutoIrrigation(nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm-summary', farmId] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      toast.success(i18n.t('irrigation.resumeSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('irrigation.resumeError'));
    },
  });
}
