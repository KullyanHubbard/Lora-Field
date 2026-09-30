import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { FarmSummaryError } from '@/components/FarmSummaryError';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getFarmLastUpdate } from '@/features/dashboard/farmStatusHelpers';
import { IrrigationHeaderCard } from '@/features/irrigation/components/IrrigationHeaderCard';
import { IrrigationLoadingState } from '@/features/irrigation/components/IrrigationLoadingState';
import { IrrigationNodeGridCard } from '@/features/irrigation/components/IrrigationNodeGridCard';
import { IrrigationRecommendationCard } from '@/features/irrigation/components/IrrigationRecommendationCard';
import { IrrigationStatsGrid } from '@/features/irrigation/components/IrrigationStatsGrid';
import { LimitedIrrigationCard } from '@/features/irrigation/components/LimitedIrrigationCard';
import {
  buildIrrigationStats,
  getIrrigationActivity,
} from '@/features/irrigation/irrigationHelpers';
import { useIrrigationSummary, useResumeAutoIrrigation } from '@/features/irrigation/queries';
import { NOTICE_CLASSES } from '@/lib/toneClasses';

export default function IrrigationPage() {
  const { id: farmId } = useParams();
  const { t } = useTranslation();
  const { data: summary, isLoading, error } = useIrrigationSummary(farmId);
  const resumeAuto = useResumeAutoIrrigation(farmId ?? '');
  const irrigationNodes = useMemo(() => summary?.nodes ?? [], [summary]);
  const pausedNodes = irrigationNodes.filter(({ node }) => node.auto_paused_at);

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
      {pausedNodes.length > 0 && (
        <Card size="sm" className={NOTICE_CLASSES.warningCard} role="alert">
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="font-medium">{t('irrigation.checkIrrigation')}</span>
            {pausedNodes.map(({ node }) => (
              <div key={node.id} className="flex items-center gap-2">
                <span>{node.name || node.id}</span>
                {summary.farm.irrigation_mode === 'auto' && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resumeAuto.isPending}
                    aria-label={t('irrigation.resumeAutoForNode', { name: node.name || node.id })}
                    onClick={() => resumeAuto.mutate(node.id)}
                  >
                    {t('irrigation.resumeAuto')}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <IrrigationHeaderCard
        gatewayStatus={summary.gateway_status}
        lastSync={lastSync}
        activity={getIrrigationActivity(irrigationNodes)}
      />

      <LimitedIrrigationCard farm={summary.farm} />

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
