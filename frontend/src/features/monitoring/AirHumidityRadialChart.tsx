import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import type { Reading } from '@/types';
import { avgOfReadings, formatTimeLabel, latestValue } from './chart-helpers';

const PALETTE = { main: '#8B5CF6', dark: '#7C3AED', light: '#A78BFA' };

interface MiniPoint {
  label: string;
  value: number;
}

export default function AirHumidityRadialChart({ readings }: { readings: Reading[] }) {
  const { t } = useTranslation();

  const readingsAsc = useMemo(() => [...readings].reverse(), [readings]);
  const current = latestValue(readingsAsc, 'air_humidity') ?? 0;
  const avg24 = useMemo(() => avgOfReadings(readingsAsc, 'air_humidity') ?? 0, [readingsAsc]);
  const deviation = current - avg24;

  const miniPoints = useMemo<MiniPoint[]>(() => {
    // downsample for mini sparkline
    const step = Math.max(1, Math.floor(readingsAsc.length / 30));
    return readingsAsc.filter((_, i) => i % step === 0).map((r) => ({
      label: formatTimeLabel(r.created_at),
      value: Number(r.air_humidity),
    }));
  }, [readingsAsc]);

  const gaugePct = current / 100;
  const avgPct = avg24 / 100;

  const config = { hum: { label: t('monitoring.chartAirHumidity'), color: PALETTE.main } } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            {t('monitoring.chartAirHumidity')}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {/* Radial gauge + current value */}
          <div className="flex items-center gap-4">
            <div className="relative h-[140px] w-[140px] shrink-0">
              <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
                {/* Background ring */}
                <circle cx={70} cy={70} r={56} fill="none" stroke="oklch(from var(--border) l c h / 0.35)" strokeWidth={10} />
                {/* Avg24 ring */}
                <circle
                  cx={70}
                  cy={70}
                  r={56}
                  fill="none"
                  stroke={PALETTE.light}
                  strokeWidth={6}
                  strokeOpacity={0.5}
                  strokeDasharray={`${(avgPct * 352).toFixed(0)} 352`}
                  strokeLinecap="round"
                />
                {/* Current ring */}
                <circle
                  cx={70}
                  cy={70}
                  r={56}
                  fill="none"
                  stroke={`url(#hum-gauge-grad)`}
                  strokeWidth={8}
                  strokeDasharray={`${(gaugePct * 352).toFixed(0)} 352`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="hum-gauge-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={PALETTE.dark} />
                    <stop offset="50%" stopColor={PALETTE.main} />
                    <stop offset="100%" stopColor={PALETTE.light} />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-foreground">{current.toFixed(0)}%</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">{avg24.toFixed(0)}%</span> {t('monitoring.avg24h')}
              </div>
              <div>
                <span
                  className="font-medium"
                  style={{ color: deviation >= 0 ? PALETTE.main : '#EF4444' }}
                >
                  {deviation >= 0 ? '+' : ''}{deviation.toFixed(1)}%
                </span>{' '}
                {t('monitoring.deviation')}
              </div>
            </div>
          </div>
          {/* Mini time series */}
          <ChartContainer config={config} className="h-[100px] w-full">
            <ComposedChart data={miniPoints} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="hum-mini-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE.main} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={PALETTE.main} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="2 2" strokeOpacity={0.3} />
              <XAxis dataKey="label" hide />
              <YAxis domain={[0, 100]} hide />
              <Area dataKey="value" type="monotone" stroke="none" fill="url(#hum-mini-grad)" dot={false} />
              <Line dataKey="value" type="monotone" stroke={PALETTE.main} strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}