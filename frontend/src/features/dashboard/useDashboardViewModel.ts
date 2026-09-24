import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useFarmGateway, useGatewayLogs } from '@/features/gateway/queries';
import {
  buildNodeHistoricalDataMap,
  buildValveSummary,
  buildWeatherForecastViewModel,
} from '@/features/dashboard/dashboardHelpers';
import { useFarmSummary } from '@/features/dashboard/queries';

export function useDashboardViewModel() {
  const { id: routeFarmId } = useParams();
  const { t, i18n } = useTranslation();
  const farmId = routeFarmId ?? '';

  const summaryQuery = useFarmSummary(farmId);
  const summary = summaryQuery.data;
  const weather = summary?.weather ?? null;

  const nodes = useMemo(() => summary?.nodes ?? [], [summary?.nodes]);
  const farmGatewayQuery = useFarmGateway(summary ? farmId : undefined);
  const activityLogQuery = useGatewayLogs(summary ? farmId : undefined, 2);
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
  const nodeHistoricalDataMap = useMemo(() => buildNodeHistoricalDataMap(nodes), [nodes]);
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
