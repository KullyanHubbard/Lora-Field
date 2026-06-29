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
import { getSoilStatusFromMoisture } from '@/lib/status';
import type { Reading } from '@/types';
import { classifySoilZone, formatTimeLabel, movingAverage, type SoilZone } from './chart-helpers';

const PALETTE = { main: '#06B6D4', dark: '#0891B2', danger: '#EF4444', warning: '#F59E0B', optimal: '#10B981' };

interface Point {
  label: string;
  value: number;
  ma: number | null;
  zone: SoilZone;
}

function buildPoints(readingsAsc: Reading[], lower: number, upper: number, window: number): Point[] {
  const values = readingsAsc.map((r) => r.soil_moisture);
  const labels = readingsAsc.map((r) => formatTimeLabel(r.created_at));
  const ma = movingAverage(values, window);
  return values.map((v, i) => ({
    label: labels[i],
    value: v,
    ma: ma[i],
    zone: classifySoilZone(v, lower, upper),
  }));
}

export default function SoilMoistureZoneChart({
  readings,
  lower,
  upper,
}: {
  readings: Reading[];
  lower: number;
  upper: number;
}) {
  const { t } = useTranslation();
  const readingsAsc = useMemo(() => [...readings].reverse(), [readings]);
  const points = useMemo(() => buildPoints(readingsAsc, lower, upper, 3), [readingsAsc, lower, upper]);

  const latest = points[points.length - 1];

  const config = { soil: { label: t('monitoring.chartSoilMoisture'), color: PALETTE.main } } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            {t('monitoring.chartSoilMoisture')}
          </CardTitle>
          {latest && (
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{latest.value.toFixed(0)}%</span>
              <StatusPill
                tone={getSoilStatusFromMoisture(latest.value, lower, upper).tone}
                label={t(getSoilStatusFromMoisture(latest.value, lower, upper).labelKey)}
              />
            </div>
          )}
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{t('farmDetail.soilTargetCaption', { lower, upper })}</div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[280px] w-full">
          <ComposedChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="soil-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PALETTE.main} stopOpacity={0.35} />
                <stop offset="100%" stopColor={PALETTE.main} stopOpacity={0.05} />
              </linearGradient>
              <filter id="soil-glow">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <ReferenceArea y1={0} y2={lower} fill={PALETTE.danger} fillOpacity={0.07} />
            <ReferenceArea y1={lower} y2={upper} fill={PALETTE.optimal} fillOpacity={0.1} />
            <ReferenceArea y1={upper} y2={100} fill={PALETTE.warning} fillOpacity={0.07} />
            <ReferenceLine y={lower} stroke={PALETTE.danger} strokeOpacity={0.25} strokeDasharray="4 4" />
            <ReferenceLine y={upper} stroke={PALETTE.warning} strokeOpacity={0.25} strokeDasharray="4 4" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v}%`} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v: unknown) => [`${Number(v ?? 0).toFixed(1)}%`, t('monitoring.chartSoilMoisture')]}
                />
              }
            />
            <Area
              dataKey="value"
              type="monotone"
              stroke="none"
              fill="url(#soil-gradient)"
              dot={false}
            />
            <Line
              dataKey="value"
              type="monotone"
              stroke={PALETTE.main}
              strokeWidth={2.5}
              filter="url(#soil-glow)"
              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                const { cx, cy, index } = props;
                if (cx == null || cy == null || index == null) return null;
                const zone = points[index]?.zone;
                const color = zone === 'danger' ? PALETTE.danger : zone === 'warning' ? PALETTE.warning : PALETTE.optimal;
                return <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#fff" strokeWidth={1} />;
              }}
            />
            <Line
              dataKey="ma"
              type="monotone"
              stroke={PALETTE.dark}
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}