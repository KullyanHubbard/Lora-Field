import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { getNodeStatusBadge } from '@/lib/status';
import type { Node, Reading } from '@/types';
import SoilMoistureZoneChart from './SoilMoistureZoneChart';
import SoilTempZoneLineChart from './SoilTempZoneLineChart';
import AirTempZoneLineChart from './AirTempZoneLineChart';
import AirHumidityZoneLineChart from './AirHumidityZoneLineChart';

interface MonitoringPanelProps {
  nodes: Node[];
  effectiveNodeId: string;
  onSelectNode: (nodeId: string) => void;
  readings: Reading[];
  readingsLoading: boolean;
  readingsError: Error | null;
  thresholds: {
    lower: number;
    upper: number;
  };
}

function MonitoringNodeSelect({
  nodes,
  effectiveNodeId,
  onSelectNode,
}: Pick<MonitoringPanelProps, 'nodes' | 'effectiveNodeId' | 'onSelectNode'>) {
  const { t } = useTranslation();

  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('monitoring.noNodes')}</p>;
  }

  return (
    <Select value={effectiveNodeId} onValueChange={onSelectNode}>
      <SelectTrigger className="w-full max-w-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {nodes.map((node) => {
          const badge = getNodeStatusBadge(node.status);
          return (
            <SelectItem key={node.id} value={node.id}>
              <span className="flex items-center gap-2">
                <span>{node.name}</span>
                <StatusPill tone={badge.tone} label={t(badge.labelKey)} />
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function MonitoringChartLoadingState() {
  return (
    <div className="grid flex-1 gap-4 md:min-h-0 md:grid-cols-2 md:grid-rows-2 md:overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="min-h-[14rem] w-full md:min-h-0" />
      ))}
    </div>
  );
}

function MonitoringChartGrid({
  readings,
  thresholds,
}: Pick<MonitoringPanelProps, 'readings' | 'thresholds'>) {
  return (
    <div className="grid flex-1 gap-4 md:min-h-0 md:grid-cols-2 md:grid-rows-2 md:overflow-hidden">
      <SoilMoistureZoneChart
        readings={readings}
        lower={thresholds.lower}
        upper={thresholds.upper}
        embedded
      />
      <SoilTempZoneLineChart readings={readings} embedded />
      <AirTempZoneLineChart readings={readings} embedded />
      <AirHumidityZoneLineChart readings={readings} embedded />
    </div>
  );
}

export function MonitoringPanel({
  nodes,
  effectiveNodeId,
  onSelectNode,
  readings,
  readingsLoading,
  readingsError,
  thresholds,
}: MonitoringPanelProps) {
  const { t } = useTranslation();

  return (
    <Card className="md:h-[calc(100svh-5.5rem)] md:max-h-[calc(100svh-5.5rem)] md:overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{t('monitoring.selectNode')}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <MonitoringNodeSelect
          nodes={nodes}
          effectiveNodeId={effectiveNodeId}
          onSelectNode={onSelectNode}
        />

        {readingsError ? (
          <p className="text-destructive">
            {t('monitoring.errorLoadReadings', { message: readingsError.message })}
          </p>
        ) : readingsLoading && readings.length === 0 ? (
          <MonitoringChartLoadingState />
        ) : readings.length === 0 ? (
          <p className="text-muted-foreground">{t('monitoring.emptyReadings')}</p>
        ) : (
          <MonitoringChartGrid readings={readings} thresholds={thresholds} />
        )}
      </CardContent>
    </Card>
  );
}
