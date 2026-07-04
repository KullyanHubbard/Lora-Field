import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, Cpu, Droplets, Sun, Thermometer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { DASH, getSelectedNodeSummary } from '@/features/farms/farmDetailHelpers';
import { DEG_C } from '@/lib/format';
import { getNodeStatusBadge } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { NodeSummary } from '@/types';

export function NodeSensorCard({
  nodes,
  className,
}: {
  nodes: NodeSummary[];
  className?: string;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const selectedNs = getSelectedNodeSummary(nodes, selected);
  const reading = selectedNs?.latest_reading ?? null;
  const badge = selectedNs ? getNodeStatusBadge(selectedNs.node.status) : null;

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="size-4 shrink-0 text-violet-500 dark:text-violet-400" />
            {t('nodes.title', 'Node Sensor')}
          </CardTitle>
          {selectedNs && (
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">
                {selectedNs.signal_rssi ?? `${DASH} dBm`}
              </span>
              {badge && <StatusPill tone={badge.tone} label={t(badge.labelKey)} />}
            </div>
          )}
        </div>
        {nodes.length > 1 && (
          <select
            value={selected ?? nodes[0]?.node.id ?? ''}
            onChange={(event) => setSelected(event.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {nodes.map((ns) => (
              <option key={ns.node.id} value={ns.node.id}>
                {ns.node.name || ns.node.location || ns.node.id}
              </option>
            ))}
          </select>
        )}
        {nodes.length <= 1 && selectedNs && (
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedNs.node.name || selectedNs.node.location || selectedNs.node.id}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center">
        {!selectedNs ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('nodes.empty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <NodeMetricTile
              icon={<Droplets className="size-4 shrink-0 text-cyan-500 dark:text-cyan-400" aria-hidden="true" />}
              label={t('nodes.colSoilMoisture')}
              value={reading ? `${reading.soil_moisture}%` : DASH}
            />
            <NodeMetricTile
              icon={<Thermometer className="size-4 shrink-0 text-orange-500 dark:text-orange-400" aria-hidden="true" />}
              label={t('nodes.colSoilTemp')}
              value={reading ? `${reading.soil_temp}${DEG_C}` : DASH}
            />
            <NodeMetricTile
              icon={<Sun className="size-4 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />}
              label={t('nodes.colAirTemp')}
              value={reading ? `${reading.air_temp}${DEG_C}` : DASH}
            />
            <NodeMetricTile
              icon={<Cloud className="size-4 shrink-0 text-sky-500 dark:text-sky-400" aria-hidden="true" />}
              label={t('nodes.colAirHumidity')}
              value={reading ? `${reading.air_humidity}%` : DASH}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NodeMetricTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="summary-subcard-interactive flex items-center gap-2 rounded-xl border border-border bg-gradient-to-b from-muted/50 to-transparent px-3 py-2.5">
      {icon}
      <div className="min-w-0">
        <p className="text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-base font-semibold tabular-nums tracking-tight text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}
