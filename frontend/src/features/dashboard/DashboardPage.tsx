import { FarmSummaryError } from '@/components/FarmSummaryError';
import { DashboardLoadingState } from '@/features/dashboard/components/DashboardLoadingState';
import { DashboardSummaryGrid } from '@/features/dashboard/components/DashboardSummaryGrid';
import { DashboardWarningCard } from '@/features/dashboard/components/DashboardWarningCard';
import { useDashboardViewModel } from '@/features/dashboard/useDashboardViewModel';

export default function DashboardPage() {
  const {
    farmId,
    summary,
    nodes,
    isLoading,
    hasError,
    errorMessage,
    warning,
    activityLogs,
    activityLogsLoading,
    activityLogsError,
    valveSummary,
    nodeHistoricalDataMap,
    weatherForecast,
  } = useDashboardViewModel();

  if (isLoading) return <DashboardLoadingState />;

  if (hasError || !summary) {
    return <FarmSummaryError message={errorMessage} />;
  }

  return (
    <div className="flex flex-col gap-4 xl:min-h-[calc(100svh-5.5rem)]">
      {warning && <DashboardWarningCard message={warning} />}

      <DashboardSummaryGrid
        farmId={farmId}
        summary={summary}
        nodes={nodes}
        activityLogs={activityLogs}
        activityLogsLoading={activityLogsLoading}
        activityLogsError={activityLogsError}
        valveSummary={valveSummary}
        nodeHistoricalDataMap={nodeHistoricalDataMap}
        weatherForecast={weatherForecast}
      />
    </div>
  );
}
