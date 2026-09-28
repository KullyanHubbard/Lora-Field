import { useState } from 'react';
import { Droplet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { ValveControlSheet } from '@/features/dashboard/components/ValveControlSheet';
import {
  SOIL_WET_WARNING_PCT,
  VALVE_BAR_CLASSES,
  type ValveSummary,
} from '@/features/dashboard/dashboardHelpers';
import {
  useSetIrrigationMode,
  useStartIrrigation,
  useStopIrrigation,
} from '@/features/dashboard/queries';
import { ACCENT_TEXT, TONE_CLASSES } from '@/lib/toneClasses';
import { cn } from '@/lib/utils';
import type { IrrigationMode, NodeSummary } from '@/types';

const MODE_OPTIONS: IrrigationMode[] = ['auto', 'manual'];

const MODE_LABEL_KEYS: Record<IrrigationMode, string> = {
  auto: 'dashboard.valveAuto',
  manual: 'dashboard.valveManual',
};

// Tinggi 44px di layar sentuh, kembali ke ukuran tombol kartu di desktop lebar.
const TOUCH_BUTTON_CLASS = 'h-11 xl:h-8';

export function ValveStatCard({
  farmId,
  mode,
  nodes,
  summary,
  className,
}: {
  farmId: string;
  mode: IrrigationMode;
  nodes: NodeSummary[];
  summary: ValveSummary;
  className?: string;
}) {
  const { t } = useTranslation();
  const { bars, totalCount, openCount, closedCount, offlineCount } = summary;
  // Ganti mode butuh 2 langkah: pilih dulu (staged), baru dikirim ke backend lewat Terapkan.
  const [stagedMode, setStagedMode] = useState<IrrigationMode | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Kelembapan tertinggi node online, untuk peringatan sebelum pengairan manual dijalankan.
  const [wetConfirm, setWetConfirm] = useState<number | null>(null);
  const setMode = useSetIrrigationMode(farmId);
  const startIrrigation = useStartIrrigation(farmId);
  const stopIrrigation = useStopIrrigation(farmId);

  const isDisconnected = totalCount > 0 && offlineCount === totalCount;
  const hasOnlineNode = nodes.some((ns) => ns.node.status === 'online');
  const isRunning = openCount > 0;
  const actionPending = startIrrigation.isPending || stopIrrigation.isPending;

  const wettest = Math.max(
    ...nodes
      .filter((ns) => ns.node.status === 'online' && ns.latest_reading)
      .map((ns) => ns.latest_reading?.soil_moisture ?? 0),
    0,
  );

  const startOrConfirm = () => {
    if (wettest >= SOIL_WET_WARNING_PCT) setWetConfirm(Math.round(wettest));
    else startIrrigation.mutate();
  };

  const applyStagedMode = () => {
    if (!stagedMode) return;
    setMode.mutate(stagedMode, { onSettled: () => setStagedMode(null) });
  };

  return (
    <div className={cn('flex flex-col rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Droplet className={cn('size-4 shrink-0', ACCENT_TEXT.cyan)} />
          <span className="truncate text-sm font-medium text-foreground">
            {t('dashboard.valveStatusCard')}
          </span>
        </div>
        {mode === 'manual' && !stagedMode && !isDisconnected && (
          <Button
            variant="link"
            size="xs"
            className="min-h-11 shrink-0 px-0 xl:min-h-0"
            onClick={() => setSheetOpen(true)}
          >
            {t('dashboard.valveManage')}
          </Button>
        )}
      </div>

      <div
        role="group"
        aria-label={t('dashboard.valveModeGroup')}
        className="mt-3 grid grid-cols-2 gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
      >
        {MODE_OPTIONS.map((option) => {
          const selected = (stagedMode ?? mode) === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              disabled={!hasOnlineNode || setMode.isPending}
              onClick={() => setStagedMode(option === mode ? null : option)}
              className={cn(
                'h-11 rounded-md text-sm font-semibold transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50 xl:h-8',
                selected
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(MODE_LABEL_KEYS[option])}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-2.5">
        {totalCount > 0 ? (
          <div className="flex gap-1" aria-hidden="true">
            {bars.map((color, index) => (
              <span
                key={index}
                className={cn('h-2 flex-1 rounded-full transition-opacity hover:opacity-80', color)}
              />
            ))}
          </div>
        ) : (
          <div className="h-2 w-full rounded-full bg-muted" aria-hidden="true" />
        )}

        {totalCount > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className={cn('size-2.5 rounded-full', VALVE_BAR_CLASSES.open)} />
              <span className="tabular-nums text-foreground">{openCount}</span>
              <span className="text-muted-foreground">{t('dashboard.valveOpen')}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className={cn('size-2.5 rounded-full', VALVE_BAR_CLASSES.closed)} />
              <span className="tabular-nums text-foreground">{closedCount}</span>
              <span className="text-muted-foreground">{t('dashboard.valveClosed')}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className={cn('size-2.5 rounded-full', VALVE_BAR_CLASSES.offline)} />
              <span className="tabular-nums text-foreground">{offlineCount}</span>
              <span className="text-muted-foreground">{t('dashboard.valveOffline')}</span>
            </span>
          </div>
        )}
      </div>

      {isDisconnected && (
        <StatusPill
          tone="red"
          label={t('dashboard.valveDisconnected')}
          className="mt-2 self-start"
        />
      )}

      {stagedMode ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            {t('dashboard.valveModeConfirm', { mode: t(MODE_LABEL_KEYS[stagedMode]) })}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              className={TOUCH_BUTTON_CLASS}
              disabled={setMode.isPending}
              onClick={applyStagedMode}
            >
              {t('dashboard.valveModeApply')}
            </Button>
            <Button
              variant="outline"
              className={TOUCH_BUTTON_CLASS}
              disabled={setMode.isPending}
              onClick={() => setStagedMode(null)}
            >
              {t('dashboard.valveModeCancel')}
            </Button>
          </div>
        </div>
      ) : wetConfirm !== null ? (
        <div className="mt-2 space-y-2">
          <p className={cn('text-xs', TONE_CLASSES.yellow.text)}>
            {t('dashboard.valveWetConfirm', { moisture: wetConfirm })}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              className={TOUCH_BUTTON_CLASS}
              disabled={actionPending}
              onClick={() =>
                startIrrigation.mutate(undefined, { onSettled: () => setWetConfirm(null) })
              }
            >
              {t('dashboard.valveWetProceed')}
            </Button>
            <Button
              variant="outline"
              className={TOUCH_BUTTON_CLASS}
              disabled={actionPending}
              onClick={() => setWetConfirm(null)}
            >
              {t('dashboard.valveModeCancel')}
            </Button>
          </div>
        </div>
      ) : (
        mode === 'manual' && (
          <Button
            variant={isRunning ? 'outline' : 'default'}
            className={cn('mt-2 w-full', TOUCH_BUTTON_CLASS)}
            disabled={actionPending || (!isRunning && !hasOnlineNode)}
            onClick={() => (isRunning ? stopIrrigation.mutate() : startOrConfirm())}
          >
            {isRunning ? t('dashboard.valveStop') : t('dashboard.valveStart')}
          </Button>
        )
      )}

      <ValveControlSheet
        farmId={farmId}
        nodes={nodes}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
