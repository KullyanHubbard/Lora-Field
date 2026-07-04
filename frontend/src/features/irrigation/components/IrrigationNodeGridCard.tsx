import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IrrigationNodeCard } from '@/features/irrigation/components/IrrigationNodeCard';
import {
  NODE_GRID_COLUMNS_CLASS,
  NODE_GRID_SCROLL_CLASS,
  NODE_SCROLL_THRESHOLD,
} from '@/features/irrigation/irrigationLayout';
import { cn } from '@/lib/utils';
import type { NodeSummary } from '@/types';

export function IrrigationNodeGridCard({
  nodes,
  lower,
  upper,
}: {
  nodes: NodeSummary[];
  lower: number;
  upper: number;
}) {
  const { t } = useTranslation();
  const shouldScrollNodes = nodes.length > NODE_SCROLL_THRESHOLD;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('irrigation.perNodeTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 p-4 pt-0 sm:p-5 sm:pt-0">
        {nodes.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            {t('irrigation.perNodeEmpty')}
          </div>
        ) : (
          <div
            className={cn(
              'grid flex-1 content-start items-start gap-3',
              NODE_GRID_COLUMNS_CLASS,
              shouldScrollNodes && NODE_GRID_SCROLL_CLASS,
            )}
          >
            {nodes.map((ns) => (
              <IrrigationNodeCard key={ns.node.id} ns={ns} lower={lower} upper={upper} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
