import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFarmSummary } from '@/features/dashboard/queries';
import {
  buildGatewayEventCounts,
  buildGatewayInfo,
  filterGatewayLogs,
  getGatewaySafePage,
  getGatewayTotalPages,
  paginateGatewayLogs,
  type GatewayEventFilter,
} from '@/features/gateway/gatewayHelpers';
import {
  useFarmGateway,
  useGatewayLogs,
} from '@/features/gateway/queries';

export function useGatewayPageViewModel() {
  const { id: farmId } = useParams();
  const summaryQuery = useFarmSummary(farmId ?? '');
  const farmGatewayQuery = useFarmGateway(farmId);
  const gateway = farmGatewayQuery.data?.gateway ?? null;
  const logsQuery = useGatewayLogs(summaryQuery.data ? farmId : undefined, 20);
  const [filter, setFilter] = useState<GatewayEventFilter>('all');
  const [page, setPage] = useState(0);

  const rawLogs = useMemo(() => logsQuery.data?.items ?? [], [logsQuery.data?.items]);
  const gatewayInfo = useMemo(() => {
    if (!summaryQuery.data) return null;
    return buildGatewayInfo(gateway);
  }, [gateway, summaryQuery.data]);

  const filteredLogs = useMemo(() => filterGatewayLogs(rawLogs, filter), [filter, rawLogs]);
  const eventCounts = useMemo(() => buildGatewayEventCounts(rawLogs), [rawLogs]);
  const totalPages = getGatewayTotalPages(filteredLogs.length);
  const safePage = getGatewaySafePage(page, totalPages);
  const pageLogs = useMemo(
    () => paginateGatewayLogs(filteredLogs, safePage),
    [filteredLogs, safePage],
  );

  function changeFilter(nextFilter: GatewayEventFilter) {
    setFilter(nextFilter);
    setPage(0);
  }

  function previousPage() {
    setPage((currentPage) => Math.max(0, currentPage - 1));
  }

  function nextPage() {
    setPage((currentPage) => Math.min(totalPages - 1, currentPage + 1));
  }

  return {
    farmId,
    summary: summaryQuery.data,
    summaryError: summaryQuery.error,
    isSummaryLoading: summaryQuery.isLoading,
    gatewayInfo,
    logs: pageLogs,
    totalLogs: filteredLogs.length,
    eventCounts,
    filter,
    safePage,
    totalPages,
    changeFilter,
    previousPage,
    nextPage,
  };
}
