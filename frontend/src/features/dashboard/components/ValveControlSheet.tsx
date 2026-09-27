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
import { getNodeLabel } from '@/features/dashboard/dashboardHelpers';
import { useSetValve } from '@/features/dashboard/queries';
import { formatClockTime, parseServerDate } from '@/lib/format';
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

  const hint = isOffline
    ? t('status.offline')
    : !hasSensorData
      ? t('dashboard.valveNoSensorData')
      : autoCloseAt
        ? t('dashboard.valveAutoCloseAt', { time: formatClockTime(autoCloseAt, i18n.language) })
        : null;

  return (
    <li className="flex min-h-14 items-center justify-between gap-3 py-2">
      <label htmlFor={switchId} className="min-w-0 flex-1 cursor-pointer">
        <span className="block truncate text-sm font-medium text-foreground">
          {getNodeLabel(node)}
        </span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </label>
      <Switch
        id={switchId}
        checked={isOpen}
        disabled={pending || isOffline || !hasSensorData}
        onCheckedChange={onToggle}
      />
    </li>
  );
}
