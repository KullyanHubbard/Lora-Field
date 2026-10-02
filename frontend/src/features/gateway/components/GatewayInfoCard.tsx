import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Radio, Signal, Wifi } from 'lucide-react';
import { StatusPill } from '@/components/ui/status-pill';
import {
  getWifiSignalLabelKey,
  type GatewayInfoViewModel,
} from '@/features/gateway/gatewayHelpers';
import { EMPTY_VALUE, formatServerDateTimeParts } from '@/lib/format';
import { ACCENT_TEXT } from '@/lib/toneClasses';
import { cn } from '@/lib/utils';

function StatTile({
  icon,
  label,
  value,
  subValue,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
}) {
  return (
    <div className="summary-subcard-interactive min-w-0 rounded-lg border border-border bg-gradient-to-b from-muted/50 to-transparent p-3">
      <div className="flex min-h-[1.25rem] items-center gap-2">
        {icon}
        <span className="text-xs leading-none text-muted-foreground">{label}</span>
      </div>
      {/* leading-tight, bukan leading-none: huruf bawah (g, y) nama WiFi tidak terpotong truncate. */}
      <p
        className="mt-1.5 truncate text-sm font-semibold leading-tight tabular-nums text-foreground"
        title={String(value)}
      >
        {value}
      </p>
      {subValue && (
        <p
          className="mt-0.5 truncate text-[0.65rem] leading-tight tabular-nums text-muted-foreground"
          title={subValue}
        >
          {subValue}
        </p>
      )}
    </div>
  );
}

export function GatewayInfoCard({
  info,
  className,
  footer,
}: {
  info: GatewayInfoViewModel;
  className?: string;
  footer?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const lastSeen = formatServerDateTimeParts(info.lastSeen, i18n.language);
  // WiFi dan sinyal hanya berarti saat gateway online. Offline: "Tidak terhubung", nama WiFi terakhir di bawahnya.
  const wifiValue = info.isOnline ? (info.wifiSsid ?? EMPTY_VALUE) : t('gateway.wifiDisconnected');
  const wifiNote =
    !info.isOnline && info.wifiSsid ? t('gateway.wifiLast', { ssid: info.wifiSsid }) : undefined;
  const showSignal = info.isOnline && info.wifiRssi != null;

  return (
    <div className={className}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Radio className={cn('size-4 shrink-0', ACCENT_TEXT.blue)} />
            <h2 className="text-base font-medium text-foreground">
              {info.displayName || t('gateway.title')}
            </h2>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{info.gatewayId}</p>
        </div>
        <StatusPill tone={info.statusTone} label={t(info.statusLabelKey)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatTile
          icon={<Wifi className={cn('size-3.5', ACCENT_TEXT.cyan)} />}
          label={t('gateway.internet')}
          value={wifiValue}
          subValue={wifiNote}
        />
        <StatTile
          icon={<Signal className={cn('size-3.5', ACCENT_TEXT.blue)} />}
          label={t('gateway.signal')}
          value={showSignal ? `${info.wifiRssi} dBm` : EMPTY_VALUE}
          subValue={showSignal ? t(getWifiSignalLabelKey(info.wifiRssi as number)) : undefined}
        />
        <StatTile
          icon={<Clock className="size-3.5 text-muted-foreground" />}
          label={t('gateway.lastSeenShort')}
          value={lastSeen?.time ?? EMPTY_VALUE}
          subValue={lastSeen?.date}
        />
      </div>
      {footer && <div className="mt-4 flex justify-end">{footer}</div>}
    </div>
  );
}
