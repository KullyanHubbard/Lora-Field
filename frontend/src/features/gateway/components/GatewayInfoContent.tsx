import { useTranslation } from 'react-i18next';
import { Radio, Signal, Wifi, Clock } from 'lucide-react';
import { getFarmLastUpdate } from '@/features/farms/farmHelpers';
import { timeAgo } from '@/lib/format';
import { StatusPill } from '@/components/ui/status-pill';
import { getGatewayStatusBadge } from '@/lib/status';
import type { FarmSummary } from '@/types';

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="summary-subcard-interactive rounded-lg border border-border bg-gradient-to-b from-muted/50 to-transparent p-3">
      <div className="flex items-center gap-2 min-h-[1.25rem]">
        {icon}
        <span className="text-xs leading-none text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold tabular-nums leading-none text-foreground">
        {value}
      </p>
    </div>
  );
}

// Isi kartu Gateway (header + grid stat) tanpa wrapper Card luar, agar bisa
// dipakai 1:1 di halaman Gateway maupun di Ringkasan Kebun. Chrome kartu
// (border/rounded/background/padding) diberikan consumer lewat `className`.
// Ikon konektivitas (Radio/Signal/Wifi) pakai warna biru sesuai pemetaan;
// status hidup/mati dibawakan badge konektivitas, bukan warna ikon.
export function GatewayInfoContent({
  summary,
  className,
}: {
  summary: FarmSummary;
  className?: string;
}) {
  const { t } = useTranslation();

  const gatewayStatus = getGatewayStatusBadge(summary.gateway_status);
  const gatewayId = `gw-${summary.farm.id}`;
  const lastSeen = getFarmLastUpdate(summary.farm, summary.nodes);

  const isOnline = summary.gateway_status === 'online';

  // Ikon stat = neon solid, beda warna per jenis (Sinyal biru, Internet cyan)
  // agar tidak sama; Terakhir tetap netral. Status hidup/mati dibawakan badge.
  const signalIconClass = 'size-3.5 text-blue-500 dark:text-blue-400';
  const internetIconClass = 'size-3.5 text-cyan-500 dark:text-cyan-400';

  return (
    <div className={className}>
      {/* Header — ikon Radio biru sejajar judul */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="size-4 shrink-0 text-blue-500 dark:text-blue-400" />
            <h2 className="text-base font-medium text-foreground">Gateway</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground font-mono">{gatewayId}</p>
        </div>
        <StatusPill tone={gatewayStatus.tone} label={t(gatewayStatus.labelKey)} />
      </div>

      {/* Stat tiles grid */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatTile
          icon={<Signal className={signalIconClass} />}
          label="Sinyal"
          value={isOnline ? 'Kuat' : '—'}
        />
        <StatTile
          icon={<Wifi className={internetIconClass} />}
          label="Internet"
          value={isOnline ? 'WiFi' : '—'}
        />
        <StatTile
          icon={<Clock className="size-3.5 text-muted-foreground" />}
          label="Terakhir"
          value={lastSeen ? timeAgo(lastSeen, t) : '—'}
        />
      </div>
    </div>
  );
}
