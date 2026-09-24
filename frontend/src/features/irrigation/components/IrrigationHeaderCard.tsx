import { Waves } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusPill } from '@/components/ui/status-pill';
import { Card, CardContent } from '@/components/ui/card';
import { formatSyncTime } from '@/features/irrigation/irrigationHelpers';
import type { FarmSummary } from '@/types';

export function IrrigationHeaderCard({
  gatewayStatus,
  lastSync,
  openValves,
}: {
  gatewayStatus: FarmSummary['gateway_status'];
  lastSync: string | null;
  openValves: number;
}) {
  const { t, i18n } = useTranslation();
  const gatewayTone = gatewayStatus === 'online' ? 'green' : 'red';
  const modeLabel = openValves > 0 ? t('irrigation.modeActive') : t('irrigation.modeMonitor');

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-2.5">
          <Waves className="mt-0.5 size-4 text-emerald-500" aria-hidden="true" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{t('irrigation.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('irrigation.subtitle')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3 lg:flex lg:items-center lg:gap-3">
          <MetaPill label={t('irrigation.modeLabel')} value={modeLabel} />
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1">
            <span className="text-muted-foreground">{t('irrigation.gatewayLabel')}</span>
            <StatusPill tone={gatewayTone} label={gatewayStatus} />
          </div>
          <MetaPill
            label={t('irrigation.syncLabel')}
            value={formatSyncTime(lastSync, i18n.language)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2 py-1">
      <span className="text-muted-foreground">{label} </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
