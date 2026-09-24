// Dashboard summary grid: 3-column layout for /farms/:id (Dashboard).
import { GatewayInfoContent } from '@/features/dashboard/components/DashboardGatewayInfoContent';
import { ActivityLogCard } from '@/features/dashboard/components/ActivityLogCard';
import { BatteryNodesCard } from '@/features/dashboard/components/BatteryNodesCard';
import { FarmMetricCardsGrid } from '@/features/dashboard/components/FarmMetricCardsGrid';
import { NodeSensorCard } from '@/features/dashboard/components/NodeSensorCard';
import { ValveStatCard } from '@/features/dashboard/components/ValveStatCard';
import { WeatherForecastCard } from '@/features/dashboard/components/WeatherForecastCard';
import type { FarmMetricChartPoint } from '@/features/dashboard/dashboardHistoricalData';
import type { ValveSummary, WeatherForecastViewModel } from '@/features/dashboard/dashboardHelpers';
import type { FarmGateway, GatewayLog, NodeSummary } from '@/types';

export function DashboardSummaryGrid({
  farmId,
  gateway,
  nodes,
  activityLogs,
  activityLogsLoading,
  activityLogsError,
  valveSummary,
  nodeHistoricalDataMap,
  weatherForecast,
}: {
  farmId: string;
  gateway: FarmGateway | null;
  nodes: NodeSummary[];
  activityLogs: GatewayLog[];
  activityLogsLoading: boolean;
  activityLogsError: unknown;
  valveSummary: ValveSummary;
  nodeHistoricalDataMap: Record<string, FarmMetricChartPoint[]>;
  weatherForecast: WeatherForecastViewModel | null;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:h-[calc(100svh-5.5rem)] xl:max-h-[calc(100svh-5.5rem)] xl:grid-cols-5 xl:grid-rows-[auto_auto_minmax(0,1fr)] xl:overflow-hidden">
      <ValveStatCard
        summary={valveSummary}
        className="sm:col-span-2 xl:col-start-1 xl:col-end-2 xl:row-start-1"
      />

      <div className="overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10 sm:col-span-2 xl:col-start-2 xl:col-end-4 xl:row-start-1">
        <GatewayInfoContent gateway={gateway} className="flex-1 p-4" />
      </div>

      <ActivityLogCard
        farmId={farmId}
        logs={activityLogs}
        isLoading={activityLogsLoading}
        error={activityLogsError}
        className="sm:col-span-2 xl:col-start-4 xl:col-end-5 xl:row-start-1"
      />

      <WeatherForecastCard
        forecast={weatherForecast}
        farmId={farmId}
        className="sm:col-span-2 xl:col-start-5 xl:col-end-6 xl:row-start-1 xl:row-span-2"
      />

      <NodeSensorCard
        nodes={nodes}
        className="sm:col-span-2 xl:col-start-1 xl:col-end-2 xl:row-start-2"
      />

      <BatteryNodesCard
        nodes={nodes}
        className="sm:col-span-2 xl:col-start-2 xl:col-end-5 xl:row-start-2"
      />

      <FarmMetricCardsGrid nodes={nodes} nodeDataMap={nodeHistoricalDataMap} />
    </div>
  );
}
