import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FarmSummaryError } from '@/components/FarmSummaryError';
import { Skeleton } from '@/components/ui/skeleton';
import { MonitoringPanel } from './components/MonitoringPanel';
import { useMonitoringViewModel } from './useMonitoringViewModel';

export default function MonitoringPage() {
  const { id: farmId } = useParams();
  const { t } = useTranslation();
  const {
    summary,
    summaryError,
    summaryLoading,
    nodes,
    effectiveNodeId,
    readings,
    readingsError,
    readingsLoading,
    selectNode,
  } = useMonitoringViewModel(farmId ?? '');

  if (summaryLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (summaryError || !summary) {
    return (
      <FarmSummaryError
        message={
          summaryError
            ? t('monitoring.errorLoadFarm', { message: summaryError.message })
            : t('monitoring.noData')
        }
      />
    );
  }

  return (
    <MonitoringPanel
      nodes={nodes}
      effectiveNodeId={effectiveNodeId}
      onSelectNode={selectNode}
      readings={readings}
      readingsLoading={readingsLoading}
      readingsError={readingsError}
      thresholds={summary.thresholds}
    />
  );
}
