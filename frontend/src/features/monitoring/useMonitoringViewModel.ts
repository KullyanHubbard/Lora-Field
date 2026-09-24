import { useCallback, useMemo, useState } from 'react';
import { useFarmSummary } from '@/features/dashboard/queries';
import { useReadings } from './queries';

interface MonitoringSelection {
  farmId: string;
  nodeId: string;
}

export function useMonitoringViewModel(farmId: string) {
  const summaryQuery = useFarmSummary(farmId);
  const summary = summaryQuery.data;

  const nodes = useMemo(() => summary?.nodes.map((ns) => ns.node) ?? [], [summary]);
  const nodeIds = useMemo(() => nodes.map((node) => node.id), [nodes]);
  const [selectedNode, setSelectedNode] = useState<MonitoringSelection | null>(null);

  const selectedNodeForFarm = selectedNode?.farmId === farmId ? selectedNode : null;
  const selectedNodeId =
    selectedNodeForFarm && nodeIds.includes(selectedNodeForFarm.nodeId)
      ? selectedNodeForFarm.nodeId
      : '';
  const effectiveNodeId = selectedNodeId || (nodes[0]?.id ?? '');

  const readingsQuery = useReadings(effectiveNodeId, 100);
  const readings = readingsQuery.data?.items ?? [];
  const selectNode = useCallback((nodeId: string) => setSelectedNode({ farmId, nodeId }), [farmId]);

  return {
    summary,
    summaryError: summaryQuery.error,
    summaryLoading: summaryQuery.isLoading,
    nodes,
    effectiveNodeId,
    readings,
    readingsError: readingsQuery.error,
    readingsLoading: readingsQuery.isLoading,
    selectNode,
  };
}
