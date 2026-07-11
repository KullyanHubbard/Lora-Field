import { useTranslation } from 'react-i18next';
import { Cloud, Droplets, Sun, Thermometer } from 'lucide-react';
import { MetricStatCard, type MetricStatCardConfig } from '@/features/dashboard/components/MetricStatCard';
import { DEG_C } from '@/lib/format';
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
      iconColor: 'text-cyan-500 dark:text-cyan-400',
      chartColor: { light: '#06b6d4', dark: '#22d3ee' },
      dataKey: 'soil_moisture' as keyof FarmMetricChartPoint,
      unit: '%',
      decimals: 0,
    },
    {
      title: t('dashboard.nodeSensor.metrics.soilTemp'),
      icon: Thermometer,
      iconColor: 'text-orange-500 dark:text-orange-400',
      chartColor: { light: '#f97316', dark: '#fb923c' },
      dataKey: 'soil_temp' as keyof FarmMetricChartPoint,
      unit: DEG_C,
      decimals: 1,
    },
    {
      title: t('dashboard.nodeSensor.metrics.airTemp'),
      icon: Sun,
      iconColor: 'text-amber-500 dark:text-amber-400',
      chartColor: { light: '#f59e0b', dark: '#fbbf24' },
      dataKey: 'air_temp' as keyof FarmMetricChartPoint,
      unit: DEG_C,
      decimals: 1,
    },
    {
      title: t('dashboard.nodeSensor.metrics.airHumidity'),
      icon: Cloud,
      iconColor: 'text-sky-500 dark:text-sky-400',
      chartColor: { light: '#0ea5e9', dark: '#38bdf8' },
      dataKey: 'air_humidity' as keyof FarmMetricChartPoint,
      unit: '%',
      decimals: 0,
    },
  ];

  return (
    <div className="grid min-h-0 flex-1 gap-4 sm:col-span-2 sm:grid-cols-2 xl:col-start-1 xl:col-end-6 xl:row-start-3 xl:h-full xl:grid-cols-4 xl:grid-rows-[minmax(0,1fr)] xl:overflow-hidden">
      {cards.map((card) => (
        <MetricStatCard
          key={card.dataKey}
          {...card}
          data={nodeDataMap}
          nodes={nodes}
        />
      ))}
    </div>
  );
}
