import { useTranslation } from 'react-i18next';
import { Cloud, Droplets, Sun, Thermometer } from 'lucide-react';
import { MetricStatCard, type MetricStatCardConfig } from '@/features/farms/components/MetricStatCard';
import { DEG_C } from '@/lib/format';
import type { ChartPoint } from '@/lib/historicalData';
import type { NodeSummary } from '@/types';

export function FarmMetricCardsGrid({
  nodes,
  nodeDataMap,
}: {
  nodes: NodeSummary[];
  nodeDataMap: Record<string, ChartPoint[]>;
}) {
  const { t } = useTranslation();
  const cards: MetricStatCardConfig[] = [
    {
      title: t('farmDetail.nodeSensor.metrics.soilMoisture'),
      icon: Droplets,
      iconColor: 'text-cyan-500 dark:text-cyan-400',
      chartColor: { light: '#06b6d4', dark: '#22d3ee' },
      dataKey: 'soil_moisture' as keyof ChartPoint,
      unit: '%',
      decimals: 0,
    },
    {
      title: t('farmDetail.nodeSensor.metrics.soilTemp'),
      icon: Thermometer,
      iconColor: 'text-orange-500 dark:text-orange-400',
      chartColor: { light: '#f97316', dark: '#fb923c' },
      dataKey: 'soil_temp' as keyof ChartPoint,
      unit: DEG_C,
      decimals: 1,
    },
    {
      title: t('farmDetail.nodeSensor.metrics.airTemp'),
      icon: Sun,
      iconColor: 'text-amber-500 dark:text-amber-400',
      chartColor: { light: '#f59e0b', dark: '#fbbf24' },
      dataKey: 'air_temp' as keyof ChartPoint,
      unit: DEG_C,
      decimals: 1,
    },
    {
      title: t('farmDetail.nodeSensor.metrics.airHumidity'),
      icon: Cloud,
      iconColor: 'text-sky-500 dark:text-sky-400',
      chartColor: { light: '#0ea5e9', dark: '#38bdf8' },
      dataKey: 'air_humidity' as keyof ChartPoint,
      unit: '%',
      decimals: 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2 xl:col-start-1 xl:col-end-6 xl:row-start-3 xl:h-full xl:min-h-0 xl:grid-cols-4">
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
