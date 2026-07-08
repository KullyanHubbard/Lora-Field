import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useGatewayLogs } from '@/features/gateway/queries';
import {
  buildNodeHistoricalDataMap,
  buildValveSummary,
  buildWeatherForecastViewModel,
} from '@/features/farms/farmDetailHelpers';
import { useFarmSummary } from '@/features/farms/queries';

export function useFarmDetailViewModel() {
  const { id: routeFarmId } = useParams();
  const { t } = useTranslation();
  const farmId = routeFarmId ?? '';

  const summaryQuery = useFarmSummary(farmId);
  const activityLogQuery = useGatewayLogs(farmId, 2);
  const summary = summaryQuery.data;
  const weather = summary?.weather ?? null;

  const nodes = useMemo(() => summary?.nodes ?? [], [summary?.nodes]);
  const errorMessage = summaryQuery.error
    ? t('farmDetail.errorLoad', { message: summaryQuery.error.message })
    : t('farmDetail.noData2');

  const warning = summary?.nodes_problem
    ? t('farmDetail.nodesProblem', { count: summary.nodes_problem })
    : null;

  const activityLogs = useMemo(
    () => activityLogQuery.data?.items ?? [],
    [activityLogQuery.data?.items],
  );
  const valveSummary = useMemo(() => buildValveSummary(nodes), [nodes]);
  const nodeHistoricalDataMap = useMemo(() => buildNodeHistoricalDataMap(nodes), [nodes]);
  const weatherForecast = useMemo(() => {
    return weather ? buildWeatherForecastViewModel(weather) : null;
  }, [weather]);

  return {
    farmId,
    summary,
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
