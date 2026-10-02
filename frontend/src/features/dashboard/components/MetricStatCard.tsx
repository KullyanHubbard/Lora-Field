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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  buildMetricChartData,
  calcMinMaxAvg,
  getMetricValues,
  getValidMetricNodeId,
} from '@/features/dashboard/dashboardHelpers';
import { cn } from '@/lib/utils';
import type { FarmMetricChartPoint } from '@/features/dashboard/dashboardHistoricalData';
import type { NodeSummary } from '@/types';
import { ACCENT_TEXT } from '@/lib/toneClasses';
import { METRIC_CARD_WINDOW_HOURS } from '@/lib/timeWindows';

export type MetricStatCardConfig = {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  // Nilai CSS variable (lib/chartColors.ts), sudah punya versi gelap sendiri.
  chartColor: string;
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
  const chartConfig = { value: { label: title, color: chartColor } } satisfies ChartConfig;
  const chartData = buildMetricChartData(points, dataKey);
  const gradId = `metric-grad-${useId().replace(/:/g, '')}`;
  const fmt = (value: number) => value.toFixed(decimals);

  return (
    <div
      className={cn('flex h-full flex-col rounded-xl border border-border bg-card p-4', className)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className={cn('size-5 shrink-0', iconColor)} aria-hidden="true" />
          <span className="truncate">{title}</span>
        </div>
        {nodes.length > 1 && (
          <Select value={validId} onValueChange={setSelected}>
            <SelectTrigger
              size="sm"
              className="max-w-[45%] min-w-0 shrink-0 text-xs data-[size=sm]:h-6.5"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {nodes.map((ns) => (
                <SelectItem key={ns.node.id} value={ns.node.id}>
                  {ns.node.name || ns.node.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!stats ? (
        <p className="mt-4 flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
          {nodes.length === 0 ? t('dashboard.nodeSensor.empty') : t('dashboard.metricNoData')}
        </p>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            <div className="summary-subcard-interactive flex flex-1 flex-col items-center justify-center rounded-lg border border-border bg-muted/30 px-2 py-1.5">
              <ArrowDown className={cn('size-3.5 shrink-0', ACCENT_TEXT.blue)} aria-hidden="true" />
              <span className="mt-1 text-[0.58rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('dashboard.metricMin')}
              </span>
              <span className="mt-0.5 text-base font-extrabold tabular-nums tracking-tight text-foreground">
                {fmt(stats.min)}
                {unit}
              </span>
            </div>
            <div className="summary-subcard-interactive flex flex-1 flex-col items-center justify-center rounded-lg border border-border bg-muted/30 px-2 py-1.5">
              <Minus className={cn('size-3.5 shrink-0', ACCENT_TEXT.amber)} aria-hidden="true" />
              <span className="mt-1 text-[0.58rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('dashboard.metricAvg')}
              </span>
              <span className="mt-0.5 text-base font-extrabold tabular-nums tracking-tight text-foreground">
                {fmt(stats.avg)}
                {unit}
              </span>
            </div>
            <div className="summary-subcard-interactive flex flex-1 flex-col items-center justify-center rounded-lg border border-border bg-muted/30 px-2 py-1.5">
              <ArrowUp className={cn('size-3.5 shrink-0', ACCENT_TEXT.red)} aria-hidden="true" />
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
              {t('dashboard.metricLastHours', { hours: METRIC_CARD_WINDOW_HOURS })}
            </span>
            <ChartContainer config={chartConfig} className="h-full min-h-0 w-full">
              <AreaChart data={chartData} margin={{ left: 16, right: 16, top: 4, bottom: 0 }}>
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
                  interval="preserveStartEnd"
                  minTickGap={12}
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
