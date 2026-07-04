import type { ReactNode } from 'react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/status';

interface MonitoringChartHeaderProps {
  title: string;
  icon: ReactNode;
  value: string | null;
  unit?: string;
  status?: {
    tone: StatusTone;
    label: string;
  };
  sideLabel: string;
  sideValue: string;
  embedded?: boolean;
  plotInsetClassName?: string;
}

export function MonitoringChartHeader({
  title,
  icon,
  value,
  unit,
  status,
  sideLabel,
  sideValue,
  embedded = false,
  plotInsetClassName = 'pl-11 pr-2',
}: MonitoringChartHeaderProps) {
  return (
    <CardHeader className="space-y-2 pb-3">
      <div className={cn('flex items-start justify-between gap-3', embedded && plotInsetClassName)}>
        <div className="min-w-0">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </CardTitle>
          {value != null && (
            <div className="mt-1 flex items-baseline gap-2">
              {icon}
              <span className="text-3xl font-bold tabular-nums text-foreground">{value}</span>
              {unit && <span className="text-base text-muted-foreground">{unit}</span>}
              {status && <StatusPill tone={status.tone} label={status.label} />}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right text-[0.65rem] text-muted-foreground">
          <div>{sideLabel}</div>
          <div className="text-sm font-semibold tabular-nums text-foreground">{sideValue}</div>
        </div>
      </div>
    </CardHeader>
  );
}
