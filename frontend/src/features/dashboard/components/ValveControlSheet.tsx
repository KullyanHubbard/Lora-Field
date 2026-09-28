import { useTranslation } from 'react-i18next';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  getNodeLabel,
  SOIL_SATURATED_PCT,
  SOIL_WET_WARNING_PCT,
} from '@/features/dashboard/dashboardHelpers';
import { useSetValve } from '@/features/dashboard/queries';
import { formatClockTime, parseServerDate } from '@/lib/format';
import { TONE_CLASSES } from '@/lib/toneClasses';
import { cn } from '@/lib/utils';
import type { NodeSummary } from '@/types';

export function ValveControlSheet({
  farmId,
  nodes,
  open,
  onOpenChange,
}: {
  farmId: string;
  nodes: NodeSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const setValve = useSetValve(farmId);
  const hasUnsentCommand = nodes.some(
    (ns) => ns.node.valve_command && !ns.node.valve_command_sent_at,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('dashboard.valveManage')}</SheetTitle>
          <SheetDescription>{t('dashboard.valveSheetDescription')}</SheetDescription>
        </SheetHeader>

        <ul className="flex-1 divide-y divide-border overflow-y-auto px-4">
          {nodes.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">{t('dashboard.valveNoNodes')}</li>
          ) : (
            nodes.map((ns) => (
              <ValveRow
                key={ns.node.id}
                ns={ns}
                pending={setValve.isPending}
                onToggle={(checked) => setValve.mutate({ nodeId: ns.node.id, open: checked })}
              />
            ))
          )}
        </ul>

        {hasUnsentCommand && (
          <SheetFooter>
            <p className="text-xs text-muted-foreground">{t('dashboard.valveUnsentNote')}</p>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ValveRow({
  ns,
  pending,
  onToggle,
}: {
  ns: NodeSummary;
  pending: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const { node } = ns;
  const isOpen = node.valve_command === 'open';
  const isOffline = node.status === 'offline';
  const hasSensorData = ns.latest_reading != null;
  const autoCloseAt = isOpen ? parseServerDate(node.valve_auto_close_at) : null;
  const switchId = `valve-${node.id}`;
  const moisture = ns.latest_reading?.soil_moisture ?? 0;
  const saturated = moisture >= SOIL_SATURATED_PCT;
  const wet = moisture >= SOIL_WET_WARNING_PCT;
  const moistureLabel = Math.round(moisture);

  const hint = isOffline
    ? t('status.offline')
    : !hasSensorData
      ? t('dashboard.valveNoSensorData')
      : saturated
        ? t('dashboard.valveSaturatedHint', { moisture: moistureLabel })
        : wet
          ? t('dashboard.valveWetHint', { moisture: moistureLabel })
          : autoCloseAt
            ? t('dashboard.valveAutoCloseAt', { time: formatClockTime(autoCloseAt, i18n.language) })
            : null;
  const warnHint = !isOffline && hasSensorData && wet;

  return (
    <li className="flex min-h-14 items-center justify-between gap-3 py-2">
      <label htmlFor={switchId} className="min-w-0 flex-1 cursor-pointer">
        <span className="block truncate text-sm font-medium text-foreground">
          {getNodeLabel(node)}
        </span>
        {hint && (
          <span
            className={cn(
              'block text-xs',
              warnHint ? TONE_CLASSES.yellow.text : 'text-muted-foreground',
            )}
          >
            {hint}
          </span>
        )}
      </label>
      <Switch
        id={switchId}
        checked={isOpen}
        // Tanah jenuh: valve tidak boleh dibuka (server juga menolak), tapi masih bisa ditutup.
        disabled={pending || isOffline || !hasSensorData || (saturated && !isOpen)}
        onCheckedChange={onToggle}
      />
    </li>
  );
}
