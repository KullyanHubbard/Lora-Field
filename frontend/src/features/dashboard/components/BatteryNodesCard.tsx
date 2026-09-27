import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BatteryFull, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GaugeRing } from '@/components/ui/gauge-ring';
import { buildBatteryGaugeModel, getNodeLabel } from '@/features/dashboard/dashboardHelpers';
import { ACCENT_TEXT, TONE_CLASSES } from '@/lib/toneClasses';
import { cn } from '@/lib/utils';
import type { NodeSummary } from '@/types';

// 4 gauge terlihat sekaligus. Lebar item di className: (100% - 3 gap x 16px) / 4.
const BATTERY_VISIBLE_COUNT = 4;

export function BatteryNodesCard({
  nodes,
  className,
}: {
  nodes: NodeSummary[];
  className?: string;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (hasAnimated || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const element = scrollRef.current?.closest('.battery-section-root') as HTMLElement | null;
    if (!element) {
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasAnimated(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    io.observe(element);
    return () => io.disconnect();
  }, [hasAnimated]);

  const updateScrollState = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    const scrollLeft = Math.min(Math.max(element.scrollLeft, 0), maxScrollLeft);
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft < maxScrollLeft - 1);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    updateScrollState();
    element.addEventListener('scroll', updateScrollState, { passive: true });
    const frame = window.requestAnimationFrame(updateScrollState);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollState) : null;
    resizeObserver?.observe(element);

    return () => {
      window.cancelAnimationFrame(frame);
      element.removeEventListener('scroll', updateScrollState);
      resizeObserver?.disconnect();
    };
  }, [updateScrollState, nodes.length]);

  const scroll = (direction: 'left' | 'right') => {
    const element = scrollRef.current;
    if (!element || element.clientWidth <= 0) return;
    element.scrollBy({
      left: direction === 'left' ? -element.clientWidth : element.clientWidth,
      behavior: 'smooth',
    });
  };

  const showArrows = nodes.length > BATTERY_VISIBLE_COUNT && (canScrollLeft || canScrollRight);

  return (
    <Card className={cn('battery-section-root', className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <BatteryFull className={cn('size-4 shrink-0', ACCENT_TEXT.emerald)} />
          {t('dashboard.gaugeBatteryCardTitle')}
        </CardTitle>
        {showArrows && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('dashboard.gaugeBatteryScrollLeft')}
              disabled={!canScrollLeft}
              onClick={() => scroll('left')}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('dashboard.gaugeBatteryScrollRight')}
              disabled={!canScrollRight}
              onClick={() => scroll('right')}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {nodes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t('dashboard.gaugeBatteryEmpty')}
          </p>
        ) : (
          <div
            ref={scrollRef}
            className={cn(
              'flex gap-4 pb-2',
              nodes.length === 1
                ? 'justify-center'
                : 'snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            )}
          >
            {nodes.map((ns) => {
              const model = buildBatteryGaugeModel(ns.node.battery);
              return (
                <div
                  key={ns.node.id}
                  className="relative isolate flex min-w-36 shrink-0 grow-0 basis-[calc((100%_-_48px)/4)] snap-start justify-center"
                >
                  {model.tone !== 'neutral' && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'pointer-events-none absolute left-1/2 top-10 -z-10 size-16 -translate-x-1/2 rounded-full blur-2xl',
                        TONE_CLASSES[model.tone].glow,
                      )}
                    />
                  )}
                  <GaugeRing
                    value={model.pct}
                    centerLabel={model.centerLabel}
                    centerSub={model.centerSubKey ? t(model.centerSubKey) : undefined}
                    tone={model.tone}
                    caption={getNodeLabel(ns.node)}
                    animate={hasAnimated}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
