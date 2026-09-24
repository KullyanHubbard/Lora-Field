import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { FarmSummaryError } from '@/components/FarmSummaryError';
import { getFarmLastUpdate } from '@/features/dashboard/farmStatusHelpers';
import { IrrigationHeaderCard } from '@/features/irrigation/components/IrrigationHeaderCard';
import { IrrigationLoadingState } from '@/features/irrigation/components/IrrigationLoadingState';
import { IrrigationNodeGridCard } from '@/features/irrigation/components/IrrigationNodeGridCard';
import { IrrigationRecommendationCard } from '@/features/irrigation/components/IrrigationRecommendationCard';
import { IrrigationStatsGrid } from '@/features/irrigation/components/IrrigationStatsGrid';
import { buildIrrigationStats } from '@/features/irrigation/irrigationHelpers';
import { useIrrigationSummary } from '@/features/irrigation/queries';

export default function IrrigationPage() {
  const { id: farmId } = useParams();
  const { t } = useTranslation();
  const { data: summary, isLoading, error } = useIrrigationSummary(farmId);
  const irrigationNodes = useMemo(() => summary?.nodes ?? [], [summary]);

  const stats = useMemo(() => {
    if (!summary) return null;
    return buildIrrigationStats(summary, irrigationNodes);
  }, [irrigationNodes, summary]);

  if (isLoading) return <IrrigationLoadingState />;

  if (error || !summary || !stats) {
    return (
      <FarmSummaryError
        message={
          error ? t('irrigation.errorLoad', { message: error.message }) : t('irrigation.noData')
        }
      />
    );
  }

  const lastSync = getFarmLastUpdate(summary.farm, irrigationNodes);

  return (
    <div className="flex flex-col gap-4 xl:h-[calc(100svh-5.5rem)] xl:max-h-[calc(100svh-5.5rem)] xl:overflow-hidden">
      <IrrigationHeaderCard
        gatewayStatus={summary.gateway_status}
        lastSync={lastSync}
        openValves={stats.openValves}
      />

      <IrrigationStatsGrid stats={stats} />

      <div className="grid min-h-[calc(100svh-335px)] flex-1 items-stretch gap-3 xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_220px] xl:grid-rows-[minmax(0,1fr)] xl:overflow-hidden">
        <IrrigationNodeGridCard
          nodes={irrigationNodes}
          lower={summary.thresholds.lower}
          upper={summary.thresholds.upper}
        />
        <IrrigationRecommendationCard
          nodes={irrigationNodes}
          stats={stats}
          lower={summary.thresholds.lower}
          upper={summary.thresholds.upper}
        />
      </div>
    </div>
  );
}
