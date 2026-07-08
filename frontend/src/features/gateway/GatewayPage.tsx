import { useTranslation } from 'react-i18next';
import { FarmSummaryError } from '@/components/FarmSummaryError';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GatewayInfoCard } from './components/GatewayInfoCard';
import { GatewayLogContent } from './components/GatewayLogContent';
import { useGatewayPageViewModel } from './useGatewayPageViewModel';

export default function GatewayPage() {
  const { t } = useTranslation();
  const {
    gatewayInfo,
    isSummaryLoading,
    summaryError,
    totalLogs,
    safePage,
    totalPages,
    filter,
    eventCounts,
    logs,
    changeFilter,
    previousPage,
    nextPage,
  } = useGatewayPageViewModel();

  if (isSummaryLoading) {
    return (
      <div className="space-y-4 max-w-xl mx-auto">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (summaryError || !gatewayInfo) {
    return (
      <FarmSummaryError
        message={
          summaryError ? t('gateway.errorLoad', { message: summaryError.message }) : t('gateway.noData')
        }
      />
    );
  }

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <GatewayInfoCard
        info={gatewayInfo}
        className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/80 p-6 transition-colors"
      />

      <Card>
        <GatewayLogContent
          logs={logs}
          totalLogs={totalLogs}
          eventCounts={eventCounts}
          filter={filter}
          page={safePage}
          totalPages={totalPages}
          onFilterChange={changeFilter}
          onPreviousPage={previousPage}
          onNextPage={nextPage}
        />
      </Card>
    </div>
  );
}
