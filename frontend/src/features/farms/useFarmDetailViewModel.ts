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

  const nodes = summaryQuery.data?.nodes ?? [];
  const errorMessage = summaryQuery.error
    ? t('farmDetail.errorLoad', { message: summaryQuery.error.message })
    : t('farmDetail.noData2');

  const warning = summaryQuery.data?.nodes_problem
    ? t('farmDetail.nodesProblem', { count: summaryQuery.data.nodes_problem })
    : null;

  const activityLogs = useMemo(
    () => activityLogQuery.data?.items ?? [],
    [activityLogQuery.data?.items],
  );
  const valveSummary = useMemo(() => buildValveSummary(nodes), [nodes]);
  const nodeHistoricalDataMap = useMemo(() => buildNodeHistoricalDataMap(nodes), [nodes]);
  const weatherForecast = useMemo(() => {
    return summaryQuery.data?.weather
      ? buildWeatherForecastViewModel(summaryQuery.data.weather)
      : null;
  }, [summaryQuery.data?.weather]);

  return {
    farmId,
    summary: summaryQuery.data,
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
