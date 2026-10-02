import { useState } from 'react';
import { CalendarClock, CircleHelp, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { LimitedIrrigationDateDialog } from '@/features/irrigation/components/LimitedIrrigationDateDialog';
import { LimitedIrrigationHelp } from '@/features/irrigation/components/LimitedIrrigationHelp';
import {
  formatLimitedUntil,
  isRiceCrop,
  limitedUntilInputValue,
} from '@/features/irrigation/limitedIrrigation';
import { useStopLimitedIrrigation } from '@/features/irrigation/queries';
import { ACCENT_TEXT } from '@/lib/toneClasses';
import { cn } from '@/lib/utils';
import type { Farm } from '@/types';

type OpenDialog = 'help' | 'start' | 'edit' | 'stop' | null;

export function LimitedIrrigationCard({ farm }: { farm: Farm }) {
  const { t, i18n } = useTranslation();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const stop = useStopLimitedIrrigation(farm.id);
  const isManual = farm.irrigation_mode === 'manual';
  const close = () => setDialog(null);

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
        <div className="flex items-center gap-1.5">
          <CalendarClock className={cn('size-4 shrink-0', ACCENT_TEXT.sky)} />
          <span className="font-semibold">{t('limitedIrrigation.title')}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('limitedIrrigation.helpLabel')}
            onClick={() => setDialog('help')}
          >
            <CircleHelp className="size-4 text-muted-foreground" />
          </Button>
        </div>
        {farm.limited_until ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {t('limitedIrrigation.activeUntil', {
                date: formatLimitedUntil(farm.limited_until, i18n.language),
              })}
            </span>
            {farm.limited_reason && (
              <span className="text-muted-foreground">
                {t(`limitedIrrigation.reason.${farm.limited_reason}`)}
              </span>
            )}
            {isManual && (
              <span className="text-muted-foreground">{t('limitedIrrigation.manualNote')}</span>
            )}
          </div>
        ) : isRiceCrop(farm.crop_type) ? (
          <span className="text-muted-foreground">{t('limitedIrrigation.riceNote')}</span>
        ) : isManual ? (
          <span className="text-muted-foreground">{t('limitedIrrigation.autoOnly')}</span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {farm.limited_until ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setDialog('edit')}>
              {t('limitedIrrigation.editDate')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDialog('stop')}>
              {t('limitedIrrigation.stop')}
            </Button>
          </>
        ) : !isRiceCrop(farm.crop_type) ? (
          <Button size="sm" disabled={isManual} onClick={() => setDialog('start')}>
            {t('limitedIrrigation.start')}
          </Button>
        ) : null}
      </div>

      {dialog === 'help' && (
        <AlertDialog open onOpenChange={(open) => !open && close()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('limitedIrrigation.title')}</AlertDialogTitle>
            </AlertDialogHeader>
            <LimitedIrrigationHelp />
            <AlertDialogFooter>
              <AlertDialogCancel>{t('limitedIrrigation.close')}</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {(dialog === 'start' || dialog === 'edit') && (
        <LimitedIrrigationDateDialog
          farmId={farm.id}
          mode={dialog}
          initialDate={dialog === 'edit' ? limitedUntilInputValue(farm.limited_until) : ''}
          onClose={close}
        />
      )}

      {dialog === 'stop' && (
        <AlertDialog open onOpenChange={(open) => !open && close()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('limitedIrrigation.stopTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('limitedIrrigation.stopDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={stop.isPending}>
                {t('limitedIrrigation.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={stop.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  stop.mutate(undefined, { onSuccess: close });
                }}
              >
                {stop.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  t('limitedIrrigation.stop')
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
