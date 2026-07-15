import { useTranslation } from 'react-i18next';
import { FarmSummaryError } from '@/components/FarmSummaryError';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GatewayInfoCard } from './components/GatewayInfoCard';
import { GatewayLogContent } from './components/GatewayLogContent';
import { GatewayProvisioningCard } from './components/GatewayProvisioningCard';
import { useGatewayPageViewModel } from './useGatewayPageViewModel';

export default function GatewayPage() {
  const { t } = useTranslation();
  const {
    gatewayInfo,
    isSummaryLoading,
    summaryError,
    farmGateway,
    farmGatewayError,
    isFarmGatewayLoading,
    gatewayDeviceId,
    setGatewayDeviceId,
    gatewayDisplayName,
    setGatewayDisplayName,
    claimSelectedGateway,
    unclaimCurrentGateway,
    isClaimingGateway,
    isUnclaimingGateway,
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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 xl:h-[calc(100svh-5.5rem)] xl:max-h-[calc(100svh-5.5rem)] xl:overflow-hidden">
      <GatewayInfoCard
        info={gatewayInfo}
        className="shrink-0 rounded-2xl border border-border bg-gradient-to-br from-card to-card/80 p-6 transition-colors"
      />

      <GatewayProvisioningCard
        farmGateway={farmGateway}
        farmGatewayError={farmGatewayError}
        isFarmGatewayLoading={isFarmGatewayLoading}
        gatewayDeviceId={gatewayDeviceId}
        onGatewayDeviceIdChange={setGatewayDeviceId}
        gatewayDisplayName={gatewayDisplayName}
        onGatewayDisplayNameChange={setGatewayDisplayName}
        onClaimGateway={claimSelectedGateway}
        onUnclaimGateway={unclaimCurrentGateway}
        isClaimingGateway={isClaimingGateway}
        isUnclaimingGateway={isUnclaimingGateway}
      />

      <Card className="min-h-0 flex-1 overflow-hidden">
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
