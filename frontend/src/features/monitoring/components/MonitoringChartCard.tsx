import type { ComponentProps, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

// Bungkus grafik Monitoring: kartu (versi embedded di grid 2x2 halaman Monitoring), header, dan area grafik.
export function MonitoringChartCard({
  header,
  config,
  embedded,
  children,
}: {
  header: ReactNode;
  config: ChartConfig;
  embedded: boolean;
  children: ComponentProps<typeof ChartContainer>['children'];
}) {
  return (
    <Card
      className={cn(
        embedded &&
          'h-full min-h-0 rounded-md bg-transparent py-3 ring-0 [--card-spacing:--spacing(3)]',
      )}
    >
      {header}
      <CardContent className={cn(embedded && 'min-h-0 flex-1')}>
        <ChartContainer
          config={config}
          className={cn('w-full', embedded ? 'h-full aspect-auto' : 'h-[280px]')}
        >
          {children}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
