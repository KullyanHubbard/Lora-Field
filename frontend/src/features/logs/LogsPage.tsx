import { FarmSummaryError } from '@/components/FarmSummaryError';
import { LogsLoadingState } from '@/features/logs/components/LogsLoadingState';
import { LogsView } from '@/features/logs/components/LogsView';
import { useLogsViewModel } from '@/features/logs/useLogsViewModel';

export default function LogsPage() {
  const {
    summary,
    isLoading,
    hasError,
    errorMessage,
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    clearDateFilter,
    filteredLogs,
    exportCsv,
  } = useLogsViewModel();

  if (isLoading) return <LogsLoadingState />;

  if (hasError || !summary) {
    return <FarmSummaryError message={errorMessage} />;
  }

  return (
    <LogsView
      activeFilter={activeFilter}
      setActiveFilter={setActiveFilter}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      dateFrom={dateFrom}
      setDateFrom={setDateFrom}
      dateTo={dateTo}
      setDateTo={setDateTo}
      clearDateFilter={clearDateFilter}
      filteredLogs={filteredLogs}
      exportCsv={exportCsv}
    />
  );
}
