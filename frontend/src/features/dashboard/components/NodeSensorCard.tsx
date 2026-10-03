import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, Cpu, Droplets, Sun, Thermometer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import { getNodeLabel, getSelectedNodeSummary } from '@/features/dashboard/dashboardHelpers';
import { DEG_C, EMPTY_VALUE } from '@/lib/format';
import { getOnlineStatusBadge } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { NodeSummary } from '@/types';
import { ACCENT_TEXT, METRIC_ACCENT_TEXT } from '@/lib/toneClasses';

export function NodeSensorCard({ nodes, className }: { nodes: NodeSummary[]; className?: string }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const selectedNs = getSelectedNodeSummary(nodes, selected);
  const reading = selectedNs?.latest_reading ?? null;
  const badge = selectedNs ? getOnlineStatusBadge(selectedNs.node.status) : null;

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className={cn('size-4 shrink-0', ACCENT_TEXT.violet)} />
            {t('dashboard.nodeSensor.title')}
          </CardTitle>
          {selectedNs && (
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">
                {`${reading?.rssi != null ? Math.round(reading.rssi) : EMPTY_VALUE} dBm`}
              </span>
              {badge && <StatusPill tone={badge.tone} label={t(badge.labelKey)} />}
            </div>
          )}
        </div>
        {nodes.length > 1 && (
          <Select value={selected ?? nodes[0]?.node.id ?? ''} onValueChange={setSelected}>
            <SelectTrigger className="mt-2 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {nodes.map((ns) => (
                <SelectItem key={ns.node.id} value={ns.node.id}>
                  {getNodeLabel(ns.node)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {nodes.length <= 1 && selectedNs && (
          <p className="mt-1 text-xs text-muted-foreground">{getNodeLabel(selectedNs.node)}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center">
        {!selectedNs ? (
          <p className="w-full py-4 text-center text-sm text-muted-foreground">
            {t('dashboard.nodeSensor.empty')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <NodeMetricTile
              icon={
                <Droplets
                  className={cn('size-4 shrink-0', METRIC_ACCENT_TEXT.soil_moisture)}
                  aria-hidden="true"
                />
              }
              label={t('dashboard.nodeSensor.metrics.soilMoisture')}
              value={reading ? `${reading.soil_moisture}%` : EMPTY_VALUE}
            />
            <NodeMetricTile
              icon={
                <Thermometer
                  className={cn('size-4 shrink-0', METRIC_ACCENT_TEXT.soil_temp)}
                  aria-hidden="true"
                />
              }
              label={t('dashboard.nodeSensor.metrics.soilTemp')}
              value={reading ? `${reading.soil_temp}${DEG_C}` : EMPTY_VALUE}
            />
            <NodeMetricTile
              icon={
                <Sun
                  className={cn('size-4 shrink-0', METRIC_ACCENT_TEXT.air_temp)}
                  aria-hidden="true"
                />
              }
              label={t('dashboard.nodeSensor.metrics.airTemp')}
              value={reading ? `${reading.air_temp}${DEG_C}` : EMPTY_VALUE}
            />
            <NodeMetricTile
              icon={
                <Cloud
                  className={cn('size-4 shrink-0', METRIC_ACCENT_TEXT.air_humidity)}
                  aria-hidden="true"
                />
              }
              label={t('dashboard.nodeSensor.metrics.airHumidity')}
              value={reading ? `${reading.air_humidity}%` : EMPTY_VALUE}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NodeMetricTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
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
