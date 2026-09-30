import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FarmSummaryError } from '@/components/FarmSummaryError';
import { DashboardLoadingState } from '@/features/dashboard/components/DashboardLoadingState';
import { DashboardSummaryGrid } from '@/features/dashboard/components/DashboardSummaryGrid';
import { DashboardWarningCard } from '@/features/dashboard/components/DashboardWarningCard';
import { useDashboardViewModel } from '@/features/dashboard/useDashboardViewModel';
import { formatLimitedUntil } from '@/features/irrigation/limitedIrrigation';

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const {
    farmId,
    summary,
    gateway,
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
    <div className="flex flex-1 flex-col gap-4">
      {warning && <DashboardWarningCard message={warning} />}
      {nodes.some(({ node }) => node.auto_paused_at) && (
        <DashboardWarningCard message={t('irrigation.checkIrrigation')} />
      )}
      {summary.farm.limited_until && (
        <DashboardWarningCard
          icon={CalendarClock}
          message={[
            t('limitedIrrigation.activeUntil', {
              date: formatLimitedUntil(summary.farm.limited_until, i18n.language),
            }),
            summary.farm.limited_reason &&
              t(`limitedIrrigation.reason.${summary.farm.limited_reason}`),
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      )}

      <DashboardSummaryGrid
        farmId={farmId}
        gateway={gateway}
        gatewayStatus={summary.gateway_status}
        irrigationMode={summary.farm.irrigation_mode}
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
