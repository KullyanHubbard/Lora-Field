import { FarmSummaryError } from '@/components/FarmSummaryError';
import { FarmDetailLoadingState } from '@/features/farms/components/FarmDetailLoadingState';
import { FarmDetailSummaryGrid } from '@/features/farms/components/FarmDetailSummaryGrid';
import { FarmDetailWarningCard } from '@/features/farms/components/FarmDetailWarningCard';
import { useFarmDetailViewModel } from '@/features/farms/useFarmDetailViewModel';

export default function FarmDetailPage() {
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
  } = useFarmDetailViewModel();

  if (isLoading) return <FarmDetailLoadingState />;

  if (hasError || !summary) {
    return <FarmSummaryError message={errorMessage} />;
  }

  return (
    <div className="flex flex-col gap-4 xl:min-h-[calc(100svh-5.5rem)]">
      {warning && <FarmDetailWarningCard message={warning} />}

      <FarmDetailSummaryGrid
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
