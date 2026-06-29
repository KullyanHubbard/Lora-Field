import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { StatusPill } from '@/components/ui/status-pill';
import type { StatusTone } from '@/lib/status';
import type { Reading } from '@/types';
import { DEG_C } from '@/lib/format';
import { type ChunkAggregate, groupByKey } from './chart-helpers';

const PALETTE = { main: '#F59E0B', dark: '#D97706', cool: '#06B6D4', hot: '#EF4444' };
const OPTIMAL_SOIL_TEMP = { min: 18, max: 28 };

function soilTempStatus(avg: number): { labelKey: string; tone: StatusTone } {
  if (avg < OPTIMAL_SOIL_TEMP.min) return { labelKey: 'soilStatus.dry', tone: 'red' };
  if (avg > OPTIMAL_SOIL_TEMP.max) return { labelKey: 'farmDetail.soilZoneWet', tone: 'yellow' };
  return { labelKey: 'soilStatus.normal', tone: 'green' };
}

interface Point extends ChunkAggregate {
  color: string;
}

function barColor(avg: number): string {
  if (avg < OPTIMAL_SOIL_TEMP.min) return PALETTE.cool;
  if (avg > OPTIMAL_SOIL_TEMP.max) return PALETTE.hot;
  const mid = (OPTIMAL_SOIL_TEMP.min + OPTIMAL_SOIL_TEMP.max) / 2;
  return avg <= mid ? PALETTE.main : PALETTE.dark;
}

export default function SoilTempComboChart({ readings }: { readings: Reading[] }) {
  const { t } = useTranslation();

  const points = useMemo<Point[]>(() => {
    const asc = [...readings].reverse();
    const chunkSize = Math.max(2, Math.ceil(asc.length / 30));
    return groupByKey(asc, 'soil_temp', chunkSize, (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      return Number.isFinite(d.getTime())
        ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        : '';
    }).map((a) => ({ ...a, color: barColor(a.avg) }));
  }, [readings]);

  const latest = points[points.length - 1];

  const config = { avg: { label: `${t('farmDetail.soilAvg')} ${DEG_C}`, color: PALETTE.main } } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            {t('monitoring.chartSoilTemp')}
          </CardTitle>
          {latest && (() => {
            const s = soilTempStatus(latest.avg);
            return (
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{latest.avg.toFixed(1)}</span>
                <span className="text-base text-muted-foreground">{DEG_C}</span>
                <StatusPill tone={s.tone} label={t(s.labelKey)} />
              </div>
            );
          })()}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[280px] w-full">
          <ComposedChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <ReferenceLine y={OPTIMAL_SOIL_TEMP.min} stroke={PALETTE.cool} strokeOpacity={0.4} strokeDasharray="5 3" />
            <ReferenceLine y={OPTIMAL_SOIL_TEMP.max} stroke={PALETTE.hot} strokeOpacity={0.4} strokeDasharray="5 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v}${DEG_C}`} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v: unknown, name: unknown) => {
                    const n = Number(v ?? 0);
                    if (name === 'min') return [`${n.toFixed(1)}${DEG_C}`, t('farmDetail.soilMin')];
                    if (name === 'max') return [`${n.toFixed(1)}${DEG_C}`, t('farmDetail.soilMax')];
                    return [`${n.toFixed(1)}${DEG_C}`, t('farmDetail.soilAvg')];
                  }}
                />
              }
            />
            <Line dataKey="min" type="monotone" stroke={PALETTE.main} strokeWidth={1} strokeOpacity={0.2} dot={false} />
            <Line dataKey="max" type="monotone" stroke={PALETTE.main} strokeWidth={1} strokeOpacity={0.2} dot={false} />
            <Bar
              dataKey="avg"
              radius={[2, 2, 0, 0]}
              maxBarSize={16}
              shape={(props: { x?: number; y?: number; width?: number; height?: number; payload?: Point }) => {
                const { x = 0, y = 0, width = 0, height = 0, payload } = props;
                return <rect x={x} y={y} width={width} height={height} fill={payload?.color ?? PALETTE.main} rx={2} ry={2} />;
              }}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}