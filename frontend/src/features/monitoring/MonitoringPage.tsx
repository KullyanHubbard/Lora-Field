import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFarmSummary } from '@/features/farms/queries';
import { useReadings } from './queries';
import { StatusPill } from '@/components/ui/status-pill';
import { getNodeStatusBadge } from '@/lib/status';
import { FarmSummaryError } from '@/components/FarmSummaryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import SoilMoistureZoneChart from './SoilMoistureZoneChart';
import SoilTempComboChart from './SoilTempComboChart';
import AirTempCandlestickChart from './AirTempCandlestickChart';
import AirHumidityRadialChart from './AirHumidityRadialChart';


export default function MonitoringPage() {
  const { id: farmId } = useParams();
  const { t } = useTranslation();
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useFarmSummary(farmId ?? '');

  const nodes = useMemo(() => summary?.nodes.map((ns) => ns.node) ?? [], [summary]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  useEffect(() => {
    setSelectedNodeId('');
  }, [farmId]);

  const effectiveNodeId = selectedNodeId || (nodes[0]?.id ?? '');

  const {
    data: readingsData,
    isLoading: readingsLoading,
    error: readingsError,
  } = useReadings(effectiveNodeId, 100);

  const readings = readingsData?.items ?? [];

  if (summaryLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (summaryError || !summary) {
    return (
      <FarmSummaryError
        message={
          summaryError
            ? t('monitoring.errorLoadFarm', { message: summaryError.message })
            : t('monitoring.noData')
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Node Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('monitoring.selectNode')}</CardTitle>
        </CardHeader>
        <CardContent>
          {nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('monitoring.noNodes')}</p>
          ) : (
            <Select
              value={effectiveNodeId}
              onValueChange={(v) => setSelectedNodeId(v)}
            >
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
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      {readingsError ? (
        <p className="text-destructive">{t('monitoring.errorLoadReadings', { message: readingsError.message })}</p>
      ) : readingsLoading && readings.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : readings.length === 0 ? (
        <p className="text-muted-foreground">{t('monitoring.emptyReadings')}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <SoilMoistureZoneChart
            readings={readings}
            lower={summary.thresholds.lower}
            upper={summary.thresholds.upper}
          />
          <SoilTempComboChart readings={readings} />
          <AirTempCandlestickChart readings={readings} />
          <AirHumidityRadialChart readings={readings} />
        </div>
      )}
    </div>
  );
}