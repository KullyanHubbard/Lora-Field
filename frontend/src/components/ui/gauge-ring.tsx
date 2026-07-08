import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type GaugeTone = 'green' | 'yellow' | 'red' | 'neutral';

interface GaugeRingProps {
  value: number | null;
  centerLabel: string;
  centerSub?: string;
  tone: GaugeTone;
  caption?: string;
  label?: string;
  animate?: boolean;
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const toneStrokeClass: Record<GaugeTone, string> = {
  green: 'stroke-emerald-500 dark:stroke-emerald-400',
  yellow: 'stroke-amber-500 dark:stroke-amber-400',
  red: 'stroke-red-500 dark:stroke-red-400',
  neutral: 'stroke-foreground/30',
};

const toneLabelClass: Record<GaugeTone, string> = {
  green: 'text-emerald-500 dark:text-emerald-400',
  yellow: 'text-amber-500 dark:text-amber-400',
  red: 'text-red-500 dark:text-red-400',
  neutral: 'text-muted-foreground',
};

function useAnimatedValue(target: number, enabled: boolean, duration = 800) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const start = performance.now();
    let frame: number;
    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled, duration]);

  return enabled ? progress : target;
}

export function GaugeRing({ value, centerLabel, centerSub, tone, caption, label, animate }: GaugeRingProps) {
  const clamped = value != null ? Math.max(0, Math.min(100, value)) : 0;
  const displayProgress = useAnimatedValue(clamped, animate === true && clamped > 0);
  const filled = (displayProgress / 100) * CIRCUMFERENCE;
  const hasData = value != null;

  return (
    <div className="flex flex-col items-center gap-2">
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
      <div className="relative size-36">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="10"
            className="stroke-foreground/10"
          />
          {hasData && (
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              className={cn(toneStrokeClass[tone], animate && 'transition-colors duration-500')}
              style={{ strokeDasharray: `${filled} ${CIRCUMFERENCE}` }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-2">
          <span
            className={cn(
              'text-2xl font-bold tabular-nums leading-none',
              hasData ? toneLabelClass[tone] : 'text-muted-foreground',
              animate && 'transition-colors duration-500',
            )}
          >
            {centerLabel}
          </span>
          {centerSub && (
            <span className="text-center text-[0.65rem] leading-tight text-muted-foreground">
              {centerSub}
            </span>
          )}
        </div>
      </div>
      {caption && (
        <span className="text-center text-xs text-muted-foreground">{caption}</span>
      )}
    </div>
  );
}
