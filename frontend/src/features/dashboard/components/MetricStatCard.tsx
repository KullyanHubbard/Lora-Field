import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Area, AreaChart, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  buildMetricChartData,
  calcMinMaxAvg,
  getMetricValues,
  getValidMetricNodeId,
} from '@/features/dashboard/dashboardHelpers';
import { cn } from '@/lib/utils';
import type { FarmMetricChartPoint } from '@/features/dashboard/dashboardHistoricalData';
import type { NodeSummary } from '@/types';

export type MetricStatCardConfig = {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  chartColor: { light: string; dark: string };
  dataKey: keyof FarmMetricChartPoint;
  unit: string;
  decimals: number;
};

export function MetricStatCard({
  title,
  icon: Icon,
  iconColor,
  chartColor,
  dataKey,
  data,
  unit,
  decimals,
  nodes,
  className,
}: MetricStatCardConfig & {
  data: Record<string, FarmMetricChartPoint[]>;
  nodes: NodeSummary[];
  className?: string;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string>('');
  const validId = getValidMetricNodeId(nodes, selected);
  const points = data[validId] ?? [];
  const stats = calcMinMaxAvg(getMetricValues(points, dataKey));
  const chartConfig = { value: { label: title, theme: chartColor } } satisfies ChartConfig;
  const chartData = buildMetricChartData(points, dataKey);
  const gradId = `metric-grad-${useId().replace(/:/g, '')}`;
  const fmt = (value: number) => value.toFixed(decimals);

  return (
    <div className={cn('flex h-full flex-col rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className={cn('size-5 shrink-0', iconColor)} aria-hidden="true" />
          <span className="truncate">{title}</span>
        </div>
        {nodes.length > 1 && (
          <select
            value={validId}
            onChange={(event) => setSelected(event.target.value)}
            className="min-w-0 max-w-[45%] shrink-0 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {nodes.map((ns) => (
              <option key={ns.node.id} value={ns.node.id}>
                {ns.node.name || ns.node.id}
              </option>
            ))}
          </select>
        )}
      </div>

      {!stats ? (
        <p className="mt-4 flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
          {t('dashboard.metricNoData')}
        </p>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            <div className="summary-subcard-interactive flex flex-1 flex-col items-center justify-center rounded-lg border border-border bg-muted/30 px-2 py-1.5">
              <ArrowDown className="size-3.5 shrink-0 text-blue-500 dark:text-blue-400" aria-hidden="true" />
              <span className="mt-1 text-[0.58rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('dashboard.metricMin')}
              </span>
              <span className="mt-0.5 text-base font-extrabold tabular-nums tracking-tight text-foreground">
                {fmt(stats.min)}
                {unit}
              </span>
            </div>
            <div className="summary-subcard-interactive flex flex-1 flex-col items-center justify-center rounded-lg border border-border bg-muted/30 px-2 py-1.5">
              <Minus className="size-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
              <span className="mt-1 text-[0.58rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('dashboard.metricAvg')}
              </span>
              <span className="mt-0.5 text-base font-extrabold tabular-nums tracking-tight text-foreground">
                {fmt(stats.avg)}
                {unit}
              </span>
            </div>
            <div className="summary-subcard-interactive flex flex-1 flex-col items-center justify-center rounded-lg border border-border bg-muted/30 px-2 py-1.5">
              <ArrowUp className="size-3.5 shrink-0 text-red-500 dark:text-red-400" aria-hidden="true" />
              <span className="mt-1 text-[0.58rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('dashboard.metricMax')}
              </span>
              <span className="mt-0.5 text-base font-extrabold tabular-nums tracking-tight text-foreground">
                {fmt(stats.max)}
                {unit}
              </span>
            </div>
          </div>

          <div className="mt-2 flex min-h-[64px] flex-1 flex-col">
            <span className="mb-0.5 text-[0.58rem] font-medium uppercase tracking-wider text-muted-foreground">
              {t('dashboard.metricLast6h')}
            </span>
            <ChartContainer config={chartConfig} className="h-full min-h-0 w-full">
              <AreaChart data={chartData} margin={{ left: 4, right: 6, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  interval={0}
                  tick={{ fontSize: 9 }}
                />
                <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      formatter={(value) => (
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {Number(value).toFixed(decimals)}
                          {unit}
                        </span>
                      )}
                    />
                  }
                />
                <Area
                  dataKey="value"
                  type="monotone"
                  stroke="var(--color-value)"
                  strokeWidth={2}
                  fill={`url(#${gradId})`}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </>
      )}
    </div>
  );
}
