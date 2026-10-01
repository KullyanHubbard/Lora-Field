import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Radio, Signal, Wifi } from 'lucide-react';
import { StatusPill } from '@/components/ui/status-pill';
import type { GatewayInfoViewModel } from '@/features/gateway/gatewayHelpers';
import { EMPTY_VALUE, timeAgo } from '@/lib/format';
import { ACCENT_TEXT } from '@/lib/toneClasses';
import { cn } from '@/lib/utils';

function StatTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="summary-subcard-interactive rounded-lg border border-border bg-gradient-to-b from-muted/50 to-transparent p-3">
      <div className="flex min-h-[1.25rem] items-center gap-2">
        {icon}
        <span className="text-xs leading-none text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-none tabular-nums text-foreground">
        {value}
      </p>
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
  const { t } = useTranslation();

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
          icon={<Signal className={cn('size-3.5', ACCENT_TEXT.blue)} />}
          label={t('gateway.signal')}
          value={t(info.signalValueKey)}
        />
        <StatTile
          icon={<Wifi className={cn('size-3.5', ACCENT_TEXT.cyan)} />}
          label={t('gateway.internet')}
          value={t(info.internetValueKey)}
        />
        <StatTile
          icon={<Clock className="size-3.5 text-muted-foreground" />}
          label={t('gateway.lastSeenShort')}
          value={info.lastSeen ? timeAgo(info.lastSeen, t) : EMPTY_VALUE}
        />
      </div>
      {footer && <div className="mt-4 flex justify-end">{footer}</div>}
    </div>
  );
}
