import { useTranslation } from 'react-i18next';
import { Cloud, Droplets, Sun, Thermometer } from 'lucide-react';
import {
  MetricStatCard,
  type MetricStatCardConfig,
} from '@/features/dashboard/components/MetricStatCard';
import { METRIC_CHART_COLORS } from '@/lib/chartColors';
import { DEG_C } from '@/lib/format';
import { METRIC_ACCENT_TEXT } from '@/lib/toneClasses';
import type { FarmMetricChartPoint } from '@/features/dashboard/dashboardHistoricalData';
import type { NodeSummary } from '@/types';

export function FarmMetricCardsGrid({
  nodes,
  nodeDataMap,
}: {
  nodes: NodeSummary[];
  nodeDataMap: Record<string, FarmMetricChartPoint[]>;
}) {
  const { t } = useTranslation();
  const cards: MetricStatCardConfig[] = [
    {
      title: t('dashboard.nodeSensor.metrics.soilMoisture'),
      icon: Droplets,
      iconColor: METRIC_ACCENT_TEXT.soil_moisture,
      chartColor: METRIC_CHART_COLORS.soil_moisture,
      dataKey: 'soil_moisture' as keyof FarmMetricChartPoint,
      unit: '%',
      decimals: 0,
    },
    {
      title: t('dashboard.nodeSensor.metrics.soilTemp'),
      icon: Thermometer,
      iconColor: METRIC_ACCENT_TEXT.soil_temp,
      chartColor: METRIC_CHART_COLORS.soil_temp,
      dataKey: 'soil_temp' as keyof FarmMetricChartPoint,
      unit: DEG_C,
      decimals: 1,
    },
    {
      title: t('dashboard.nodeSensor.metrics.airTemp'),
      icon: Sun,
      iconColor: METRIC_ACCENT_TEXT.air_temp,
      chartColor: METRIC_CHART_COLORS.air_temp,
      dataKey: 'air_temp' as keyof FarmMetricChartPoint,
      unit: DEG_C,
      decimals: 1,
    },
    {
      title: t('dashboard.nodeSensor.metrics.airHumidity'),
      icon: Cloud,
      iconColor: METRIC_ACCENT_TEXT.air_humidity,
      chartColor: METRIC_CHART_COLORS.air_humidity,
      dataKey: 'air_humidity' as keyof FarmMetricChartPoint,
      unit: '%',
      decimals: 0,
    },
  ];

  return (
    <div className="grid min-h-0 flex-1 gap-4 sm:col-span-2 sm:grid-cols-2 xl:col-start-1 xl:col-end-6 xl:row-start-3 xl:h-full xl:grid-cols-4 xl:grid-rows-[minmax(0,1fr)] xl:overflow-hidden">
      {cards.map((card) => (
        <MetricStatCard key={card.dataKey} {...card} data={nodeDataMap} nodes={nodes} />
      ))}
    </div>
  );
}
