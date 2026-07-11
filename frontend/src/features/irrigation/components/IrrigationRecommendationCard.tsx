import { useTranslation } from 'react-i18next';
import { StatusPill } from '@/components/ui/status-pill';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getNodeMoisture,
  moistureCondition,
  valveKeyFromDecision,
  type IrrigationStats,
} from '@/features/irrigation/irrigationHelpers';
import { getValveStatusBadge } from '@/lib/status';
import type { NodeSummary } from '@/types';

export function IrrigationRecommendationCard({
  nodes,
  stats,
  lower,
  upper,
}: {
  nodes: NodeSummary[];
  stats: IrrigationStats;
  lower: number;
  upper: number;
}) {
  const { t } = useTranslation();

  return (
    <Card className="h-full min-h-0 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('irrigation.recommendationTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 pt-0">
        {nodes.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('irrigation.recommendationEmpty')}</p>
        ) : stats.driestNodes.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('irrigation.recommendationWaitingMoisture')}</p>
        ) : (
          stats.driestNodes.map((ns) => {
            const moisture = getNodeMoisture(ns);
            const condition = moistureCondition(moisture, lower, upper);
            const valveBadge = ns.decision ? getValveStatusBadge(valveKeyFromDecision(ns.decision)) : null;

            return (
              <div
                key={ns.node.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-foreground">{ns.node.name || ns.node.id}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {moisture ?? '—'}% · {t(condition.labelKey)}
                  </div>
                </div>
                {valveBadge ? (
                  <StatusPill tone={valveBadge.tone} label={t(valveBadge.labelKey)} />
                ) : (
                  <StatusPill tone="neutral" label="—" />
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
