import { Droplets, Gauge, Radio, Waves } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import type { IrrigationStats } from '@/features/irrigation/irrigationHelpers';
import { EMPTY_VALUE } from '@/lib/format';
import { ACCENT_TEXT } from '@/lib/toneClasses';

export function IrrigationStatsGrid({ stats }: { stats: IrrigationStats }) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <SummaryCard
        label={t('irrigation.totalNodes')}
        value={stats.totalNodes}
        icon={<Radio className="size-3.5" />}
      />
      <SummaryCard
        label={t('irrigation.openValves')}
        value={stats.openValves}
        icon={<Waves className="size-3.5" />}
        tone={ACCENT_TEXT.emerald}
      />
      <SummaryCard
        label={t('irrigation.closedValves')}
        value={stats.closedValves}
        icon={<Waves className="size-3.5" />}
        tone={ACCENT_TEXT.amber}
      />
      <SummaryCard
        label={t('irrigation.avgMoistureShort')}
        value={stats.avgMoisture == null ? EMPTY_VALUE : `${stats.avgMoisture.toFixed(0)}%`}
        icon={<Droplets className="size-3.5" />}
      />
      <SummaryCard
        label={t('irrigation.belowThreshold')}
        value={stats.belowThresholdNodes}
        icon={<Gauge className="size-3.5" />}
        tone={ACCENT_TEXT.red}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone = 'text-muted-foreground',
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div
          className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider ${tone}`}
        >
          {icon}
          {label}
        </div>
        <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}
