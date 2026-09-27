import { LogsTableCard } from '@/features/logs/components/LogsTableCard';
import { LogsToolbarCard } from '@/features/logs/components/LogsToolbarCard';
import type { LogFilterKey } from '@/features/logs/logHelpers';
import type { ScopedLog } from '@/features/logs/useLogsViewModel';

export function LogsView({
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
  truncatedAt,
  exportCsv,
}: {
  activeFilter: LogFilterKey;
  setActiveFilter: (filter: LogFilterKey) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
  clearDateFilter: () => void;
  filteredLogs: ScopedLog[];
  truncatedAt: number | null;
  exportCsv: () => void;
}) {
  return (
    <div className="space-y-6">
      <LogsToolbarCard
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        onClearDateFilter={clearDateFilter}
        onExportCsv={exportCsv}
        exportDisabled={!filteredLogs.length}
      />

      <LogsTableCard logs={filteredLogs} truncatedAt={truncatedAt} />
    </div>
  );
}
