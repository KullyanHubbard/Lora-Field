import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { StatusPill } from '@/components/ui/status-pill';
import type { Reading } from '@/types';
import { DEG_C } from '@/lib/format';
import { bollingerBands, formatTimeLabel, groupByKey, type ChunkAggregate } from './chart-helpers';

const PALETTE = { main: '#EF4444', dark: '#DC2626', hot: '#B91C1C', warm: '#F97316' };
const DANGER_ZONE = 35;

interface Point extends ChunkAggregate {
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
}

export default function AirTempCandlestickChart({ readings }: { readings: Reading[] }) {
  const { t } = useTranslation();

  const points = useMemo<Point[]>(() => {
    const asc = [...readings].reverse();
    const chunkSize = Math.max(2, Math.ceil(asc.length / 40));
    const chunks = groupByKey(asc, 'air_temp', chunkSize, (iso) => formatTimeLabel(iso));
    const avgVals = chunks.map((c) => c.avg);
    const bb = bollingerBands(avgVals, Math.min(5, Math.max(3, Math.floor(avgVals.length / 4))), 1.5);
    return chunks.map((c, i) => ({
      ...c,
      bbUpper: bb.upper[i],
      bbMiddle: bb.middle[i],
      bbLower: bb.lower[i],
    }));
  }, [readings]);

  const latest = points[points.length - 1];
  const config = { avg: { label: DEG_C, color: PALETTE.main } } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            {t('monitoring.chartAirTemp')}
          </CardTitle>
          {latest && (
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{latest.avg.toFixed(1)}</span>
              <span className="text-base text-muted-foreground">{DEG_C}</span>
              {latest.avg >= DANGER_ZONE && (
                <StatusPill tone="red" label={t('monitoring.hotLabel')} />
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[280px] w-full">
          <ComposedChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="airt-bb" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PALETTE.main} stopOpacity={0.12} />
                <stop offset="100%" stopColor={PALETTE.main} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <ReferenceArea y1={DANGER_ZONE} fill={PALETTE.dark} fillOpacity={0.06} />
            <ReferenceLine y={DANGER_ZONE} stroke={PALETTE.hot} strokeOpacity={0.45} strokeDasharray="4 4" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v}${DEG_C}`} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v: unknown, name: unknown) => {
                    const n = Number(v ?? 0);
                    if (name === 'avg') return [`${n.toFixed(1)}${DEG_C}`, t('farmDetail.soilAvg')];
                    if (name === 'min') return [`${n.toFixed(1)}${DEG_C}`, t('farmDetail.soilMin')];
                    if (name === 'max') return [`${n.toFixed(1)}${DEG_C}`, t('farmDetail.soilMax')];
                    return [`${n.toFixed(1)}${DEG_C}`, String(name)];
                  }}
                />
              }
            />
            {/* Bollinger envelope */}
            <Area dataKey="bbUpper" type="monotone" stroke="none" fill="url(#airt-bb)" dot={false} />
            <Area dataKey="bbLower" type="monotone" stroke="none" fill="transparent" dot={false} />
            <Line dataKey="bbUpper" type="monotone" stroke={PALETTE.warm} strokeWidth={0.8} strokeOpacity={0.35} dot={false} />
            <Line dataKey="bbMiddle" type="monotone" stroke={PALETTE.main} strokeWidth={0.8} strokeOpacity={0.3} strokeDasharray="3 3" dot={false} />
            <Line dataKey="bbLower" type="monotone" stroke={PALETTE.warm} strokeWidth={0.8} strokeOpacity={0.35} dot={false} />
            {/* Candlestick body = avg (solid), wick = min/max (thin) */}
            <Line dataKey="min" type="monotone" stroke={PALETTE.warm} strokeWidth={1} strokeOpacity={0.5} dot={false} />
            <Line dataKey="max" type="monotone" stroke={PALETTE.warm} strokeWidth={1} strokeOpacity={0.5} dot={false} />
            <Line
              dataKey="avg"
              type="monotone"
              stroke={PALETTE.main}
              strokeWidth={2.5}
              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                const { cx, cy, index } = props;
                if (cx == null || cy == null || index == null) return null;
                const pt = points[index];
                const isHot = pt?.avg != null && pt.avg >= DANGER_ZONE;
                return (
                  <g>
                    <circle cx={cx} cy={cy} r={4} fill={isHot ? PALETTE.hot : PALETTE.main} stroke="#fff" strokeWidth={1} />
                  </g>
                );
              }}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}