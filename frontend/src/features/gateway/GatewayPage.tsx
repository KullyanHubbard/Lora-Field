import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RadioTower, WifiOff } from 'lucide-react';
import { useFarmSummary } from '@/features/farms/queries';
import { useGatewayLogs } from './queries';
import { getFarmLastUpdate } from '@/features/farms/farmHelpers';
import { getGatewayStatusBadge, isMock } from '@/lib/status';
import { timeAgo } from '@/lib/format';
import { StatusPill, type PillTone } from '@/components/ui/status-pill';
import { FarmSummaryError } from '@/components/FarmSummaryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{children}</span>
    </div>
  );
}

// Tone badge untuk event log koneksi gateway (string bebas dari backend).
// Tidak ada enum dipaksakan; default neutral untuk event yang tak dikenal.
function gatewayEventTone(event: string): PillTone {
  const normalized = event.trim().toLowerCase();
  if (normalized === 'online' || normalized === 'connected') return 'green';
  if (normalized === 'offline' || normalized === 'disconnected') return 'red';
  return 'neutral';
}

export default function GatewayPage() {
  const { t } = useTranslation();
  const { id: farmId } = useParams();
  const { data: summary, isLoading, error } = useFarmSummary(farmId ?? '');
  const { data: gatewayLogs } = useGatewayLogs(farmId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-56 w-full max-w-xl" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <FarmSummaryError
        message={
          error ? t('gateway.errorLoad', { message: error.message }) : t('gateway.noData')
        }
      />
    );
  }

  const gwBadge = getGatewayStatusBadge(summary.gateway_status);
  const isOffline = summary.gateway_status === 'offline';
  const GwIcon = isOffline ? WifiOff : RadioTower;
  const gatewayId = `gw-${summary.farm.id}`;
  const nodesTotal = summary.nodes.length;
  const nodesActive = summary.nodes.filter((ns) => ns.node.status !== 'offline').length;
  const lastSeen = getFarmLastUpdate(summary.farm, summary.nodes);
  const isMockData = isMock(summary);
  const logs = gatewayLogs?.items ?? [];

  return (
    <div className="max-w-xl space-y-4">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RadioTower className="size-4 text-muted-foreground" /> {t('gateway.title')}
          {isMockData && <StatusPill tone="yellow" label="Data Contoh" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-2 py-2">
          <GwIcon className="size-12 text-muted-foreground" />
          <StatusPill tone={gwBadge.tone} label={t(gwBadge.labelKey)} />
        </div>
        <div>
          <InfoRow label={t('gateway.idLabel')}>
            <span className="font-mono">{gatewayId}</span>
          </InfoRow>
          <InfoRow label={t('gateway.activeNodes')}>
            {nodesActive}/{nodesTotal}
          </InfoRow>
          <InfoRow label={t('gateway.lastSeen')}>{timeAgo(lastSeen, t)}</InfoRow>
          {/* TODO (future): status koneksi internet gateway belum dilaporkan backend.
              Saat hardware gateway lapor konektivitas, tambah field (mis. internet_status)
              di response summary atau endpoint gateway, lalu render di sini. */}
          <InfoRow label={t('gateway.internetConn')}>
            <span className="text-muted-foreground">{t('gateway.internetNotMonitored')}</span>
          </InfoRow>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RadioTower className="size-4 text-muted-foreground" /> {t('gateway.logsTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t('gateway.logsEmpty')}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex items-start justify-between gap-3 border-b border-border pb-2.5 text-sm last:border-b-0 last:pb-0"
              >
                <div className="space-y-1">
                  <StatusPill tone={gatewayEventTone(log.event)} label={log.event} />
                  {log.detail && (
                    <p className="text-muted-foreground">{log.detail}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {timeAgo(log.created_at, t)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
