import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useFarmGateway, useGatewayLogs } from '@/features/gateway/queries';
import {
  buildNodeHistoricalDataMap,
  buildValveSummary,
  buildWeatherForecastViewModel,
} from '@/features/dashboard/dashboardHelpers';
import { useFarmSummary, useNodesReadings } from '@/features/dashboard/queries';
import type { Reading } from '@/types';

// Jumlah log gateway terbaru di kartu Log Aktivitas.
const ACTIVITY_LOG_PREVIEW_COUNT = 2;

export function useDashboardViewModel() {
  const { id: routeFarmId } = useParams();
  const { t, i18n } = useTranslation();
  const farmId = routeFarmId ?? '';

  const summaryQuery = useFarmSummary(farmId);
  const summary = summaryQuery.data;
  const weather = summary?.weather ?? null;

  const nodes = useMemo(() => summary?.nodes ?? [], [summary?.nodes]);
  const farmGatewayQuery = useFarmGateway(summary ? farmId : undefined);
  const activityLogQuery = useGatewayLogs(summary ? farmId : undefined, ACTIVITY_LOG_PREVIEW_COUNT);
  const errorMessage = summaryQuery.error
    ? t('dashboard.errorLoad', { message: summaryQuery.error.message })
    : t('dashboard.noData2');

  const warning = summary?.nodes_problem
    ? t('dashboard.nodesProblem', { count: summary.nodes_problem })
    : null;

  const activityLogs = useMemo(
    () => activityLogQuery.data?.items ?? [],
    [activityLogQuery.data?.items],
  );
  const valveSummary = useMemo(() => buildValveSummary(nodes), [nodes]);
  const nodeIds = useMemo(() => nodes.map((ns) => ns.node.id), [nodes]);
  const readingsQueries = useNodesReadings(nodeIds);
  const readingsByNode: Record<string, Reading[]> = {};
  nodeIds.forEach((nodeId, index) => {
    readingsByNode[nodeId] = readingsQueries[index]?.data?.items ?? [];
  });
  // Jendela 6 jam dihitung dari waktu fetch terakhir, bukan Date.now() saat render.
  const readingsFetchedAt = Math.max(0, ...readingsQueries.map((query) => query.dataUpdatedAt));
  const nodeHistoricalDataMap = buildNodeHistoricalDataMap(
    nodes,
    readingsByNode,
    readingsFetchedAt,
    i18n.language,
  );
  const weatherForecast = useMemo(() => {
    return weather ? buildWeatherForecastViewModel(weather, t, i18n.language) : null;
  }, [weather, t, i18n.language]);

  return {
    farmId,
    summary,
    gateway: farmGatewayQuery.data?.gateway ?? null,
    nodes,
    isLoading: summaryQuery.isLoading,
    hasError: Boolean(summaryQuery.error) || !summaryQuery.data,
    errorMessage,
    warning,
    activityLogs,
    activityLogsLoading: activityLogQuery.isLoading,
    activityLogsError: activityLogQuery.error,
    valveSummary,
    nodeHistoricalDataMap,
    weatherForecast,
  };
}
