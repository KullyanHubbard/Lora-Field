import { Waves } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusPill } from '@/components/ui/status-pill';
import { Card, CardContent } from '@/components/ui/card';
import {
  formatSyncTime,
  IRRIGATION_ACTIVITY_LABEL_KEYS,
  type IrrigationActivity,
} from '@/features/irrigation/irrigationHelpers';
import { LimitedIrrigationCard } from '@/features/irrigation/components/LimitedIrrigationCard';
import type { Farm, FarmSummary } from '@/types';
import { ACCENT_TEXT } from '@/lib/toneClasses';
import { cn } from '@/lib/utils';

export function IrrigationHeaderCard({
  farm,
  gatewayStatus,
  lastSync,
  activity,
}: {
  farm: Farm;
  gatewayStatus: FarmSummary['gateway_status'];
  lastSync: string | null;
  activity: IrrigationActivity;
}) {
  const { t, i18n } = useTranslation();
  const gatewayTone = gatewayStatus === 'online' ? 'green' : 'red';

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Waves className={cn('size-6', ACCENT_TEXT.emerald)} aria-hidden="true" />
            <h1 className="text-2xl font-semibold tracking-tight">{t('irrigation.title')}</h1>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3 lg:flex lg:items-center lg:gap-3">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5 font-semibold text-foreground">
              {t(IRRIGATION_ACTIVITY_LABEL_KEYS[activity])}
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5">
              <span className="text-muted-foreground">{t('irrigation.gatewayLabel')}</span>
              <StatusPill tone={gatewayTone} label={gatewayStatus} className="text-sm" />
            </div>
            <MetaPill
              label={t('irrigation.syncLabel')}
              value={formatSyncTime(lastSync, i18n.language)}
            />
          </div>
        </div>
        <div className="border-t border-border/60 pt-3">
          <LimitedIrrigationCard farm={farm} />
        </div>
      </CardContent>
    </Card>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5">
      <span className="text-muted-foreground">{label} </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
