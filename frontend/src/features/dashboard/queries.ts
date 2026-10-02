import {
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { api } from '@/lib/api';
import type { CreateFarmPayload, IrrigationMode, Node } from '@/types';
import { LIVE_DATA_INTERVAL_MS, SLOW_DATA_STALE_MS } from '@/lib/queryTiming';
import { READINGS_FETCH_HOURS } from '@/lib/timeWindows';

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
    refetchInterval: LIVE_DATA_INTERVAL_MS,
  });
}

// Reading satu node. Dipakai kartu metrik Dashboard dan grafik Monitoring, jadi cache-nya terpakai bersama.
export function readingsQuery(nodeId: string) {
  return queryOptions({
    queryKey: ['readings', nodeId, READINGS_FETCH_HOURS],
    queryFn: () => api.getReadings(nodeId, READINGS_FETCH_HOURS),
    refetchInterval: LIVE_DATA_INTERVAL_MS,
  });
}

// Reading semua node untuk grafik kartu metrik.
export function useNodesReadings(nodeIds: string[]) {
  return useQueries({ queries: nodeIds.map(readingsQuery) });
}

export function useCrops(q?: string) {
  return useQuery({
    queryKey: ['crops', q ?? ''],
    queryFn: () => api.getCrops(q ?? ''),
    staleTime: SLOW_DATA_STALE_MS, // daftar tanaman jarang berubah
  });
}

export function useCreateFarm() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (payload: CreateFarmPayload) => api.createFarm(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      toast.success(i18n.t('farms.toastCreateSuccess'));
      navigate('/select-farms', { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('farms.toastCreateError'));
    },
  });
}

// Perintah valve baru disimpan di server; alat menerimanya setelah ada jalur MQTT.
function notifyValveCommand(nodes: Node[]) {
  const unsent = nodes.some((node) => node.valve_command && !node.valve_command_sent_at);
  toast.success(
    i18n.t('dashboard.valveCommandSaved'),
    unsent ? { description: i18n.t('dashboard.valveCommandUnsent') } : undefined,
  );
}

function useValveMutation<TVariables, TResult>(
  farmId: string,
  mutationFn: (variables: TVariables) => Promise<TResult>,
  onDone: (result: TResult) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['farm-summary', farmId] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      onDone(result);
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('dashboard.valveCommandError'));
    },
  });
}

export function useSetIrrigationMode(farmId: string) {
  return useValveMutation(
    farmId,
    (mode: IrrigationMode) => api.setIrrigationMode(farmId, mode),
    ({ farm }) => {
      const modeLabel = i18n.t(
        farm.irrigation_mode === 'manual' ? 'dashboard.valveManual' : 'dashboard.valveAuto',
      );
      toast.success(i18n.t('dashboard.valveModeChanged', { mode: modeLabel }));
    },
  );
}

export function useStartIrrigation(farmId: string) {
  return useValveMutation<void, { nodes: Node[] }>(
    farmId,
    () => api.startIrrigation(farmId),
    ({ nodes }) => notifyValveCommand(nodes),
  );
}

export function useStopIrrigation(farmId: string) {
  return useValveMutation<void, { nodes: Node[] }>(
    farmId,
    () => api.stopIrrigation(farmId),
    ({ nodes }) => notifyValveCommand(nodes),
  );
}

export function useSetValve(farmId: string) {
  return useValveMutation(
    farmId,
    ({ nodeId, open }: { nodeId: string; open: boolean }) => api.setValve(nodeId, open),
    ({ node }) => notifyValveCommand([node]),
  );
}
