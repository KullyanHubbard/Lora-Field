import { Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusPill } from '@/components/ui/status-pill';
import { NODE_CARD_MIN_HEIGHT_CLASS } from '@/features/irrigation/irrigationLayout';
import {
  formatSyncTime,
  moistureCondition,
  valveKeyFromDecision,
} from '@/features/irrigation/irrigationHelpers';
import { getIrrigationStatusBadge, getValveStatusBadge } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { NodeSummary } from '@/types';
import { EMPTY_VALUE } from '@/lib/format';

export function IrrigationNodeCard({
  ns,
  lower,
  upper,
}: {
  ns: NodeSummary;
  lower: number;
  upper: number;
}) {
  const { t, i18n } = useTranslation();
  const reading = ns.latest_reading;
  const moisture = reading?.soil_moisture ?? null;
  const condition = moistureCondition(moisture, lower, upper);
  const irrBadge = ns.decision ? getIrrigationStatusBadge(ns.decision.decision) : null;
  const valveBadge = ns.decision ? getValveStatusBadge(valveKeyFromDecision(ns.decision)) : null;
  const progress = moisture == null ? 0 : Math.max(0, Math.min(100, moisture));

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-border bg-card p-4 text-card-foreground',
        NODE_CARD_MIN_HEIGHT_CLASS,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[0.95rem] font-medium text-foreground">
            {ns.node.name || ns.node.id}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {ns.node.location || EMPTY_VALUE}
          </div>
        </div>
        {valveBadge ? (
          <StatusPill tone={valveBadge.tone} label={t(valveBadge.labelKey)} />
        ) : (
          <StatusPill tone="neutral" label={t('irrigation.waitingData')} />
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums text-foreground">
            {moisture == null ? EMPTY_VALUE : `${moisture}%`}
          </span>
          <StatusPill tone={condition.tone} label={t(condition.labelKey)} />
        </div>
        {irrBadge ? (
          <StatusPill tone={irrBadge.tone} label={t(irrBadge.labelKey)} />
        ) : (
          <StatusPill tone="neutral" label={EMPTY_VALUE} />
        )}
      </div>

      <div className="mt-2 space-y-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${condition.bar}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0%</span>
          <span>{`${lower}–${upper}%`}</span>
          <span>100%</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <Timer className="mr-1 inline size-3" aria-hidden="true" />
          {formatSyncTime(reading?.created_at ?? ns.node.updated_at, i18n.language)}
        </span>
      </div>
    </div>
  );
}
