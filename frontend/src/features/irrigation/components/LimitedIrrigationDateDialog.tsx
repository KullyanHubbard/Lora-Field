import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import {
  dateInputFromToday,
  endOfDayIso,
  formatDateInput,
  isLimitedDateAllowed,
  LIMITED_IRRIGATION_MAX_DAYS,
  LIMITED_IRRIGATION_REASONS,
} from '@/features/irrigation/limitedIrrigation';
import {
  useStartLimitedIrrigation,
  useUpdateLimitedIrrigation,
} from '@/features/irrigation/queries';
import type { LimitedIrrigationReason } from '@/types';

interface LimitedIrrigationDateDialogProps {
  farmId: string;
  // 'edit' hanya mengubah tanggal selesai; alasan tetap.
  mode: 'start' | 'edit';
  initialDate?: string;
  onClose: () => void;
}

export function LimitedIrrigationDateDialog({
  farmId,
  mode,
  initialDate = '',
  onClose,
}: LimitedIrrigationDateDialogProps) {
  const { t, i18n } = useTranslation();
  const [reason, setReason] = useState<LimitedIrrigationReason | null>(null);
  const [date, setDate] = useState(initialDate);
  const start = useStartLimitedIrrigation(farmId);
  const update = useUpdateLimitedIrrigation(farmId);
  const isPending = start.isPending || update.isPending;

  const dateAllowed = isLimitedDateAllowed(date);
  const canSave =
    dateAllowed && !isPending && (mode === 'start' ? reason !== null : date !== initialDate);

  const handleSave = () => {
    if (!canSave) return;
    const until = endOfDayIso(date);
    if (mode === 'start' && reason) {
      start.mutate({ reason, until }, { onSuccess: onClose });
    } else {
      update.mutate(until, { onSuccess: onClose });
    }
  };

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === 'start'
              ? t('limitedIrrigation.startTitle')
              : t('limitedIrrigation.editTitle')}
          </AlertDialogTitle>
          {mode === 'start' && (
            <AlertDialogDescription>{t('limitedIrrigation.reasonQuestion')}</AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {mode === 'start' && (
          <div
            className="grid gap-2"
            role="group"
            aria-label={t('limitedIrrigation.reasonQuestion')}
          >
            {LIMITED_IRRIGATION_REASONS.map((option) => (
              <Button
                key={option.key}
                type="button"
                variant={reason === option.key ? 'default' : 'outline'}
                aria-pressed={reason === option.key}
                className="h-auto justify-between gap-3 py-2 text-left whitespace-normal"
                onClick={() => {
                  setReason(option.key);
                  setDate(dateInputFromToday(option.days));
                }}
              >
                <span>
                  {t(`limitedIrrigation.reason.${option.key}`)}
                  <span className="block text-xs opacity-80">
                    {t(`limitedIrrigation.reasonHint.${option.key}`)}
                  </span>
                </span>
                <span className="shrink-0 text-xs opacity-80">
                  {t('limitedIrrigation.weeks', { count: option.days / 7 })}
                </span>
              </Button>
            ))}
          </div>
        )}

        {(mode === 'edit' || reason) && (
          <div className="grid gap-1.5">
            <label htmlFor="limited-irrigation-date" className="text-sm text-muted-foreground">
              {t('limitedIrrigation.endDate')}
            </label>
            <Input
              id="limited-irrigation-date"
              type="date"
              value={date}
              min={dateInputFromToday(1)}
              max={dateInputFromToday(LIMITED_IRRIGATION_MAX_DAYS)}
              onChange={(e) => setDate(e.target.value)}
            />
            {dateAllowed ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium">
                  {t('limitedIrrigation.activeUntil', {
                    date: formatDateInput(date, i18n.language),
                  })}
                </p>
                <p className="text-muted-foreground">{t('limitedIrrigation.confirmDesc')}</p>
              </div>
            ) : (
              <p className="text-sm text-destructive">
                {t('limitedIrrigation.dateInvalid', { days: LIMITED_IRRIGATION_MAX_DAYS })}
              </p>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t('limitedIrrigation.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!canSave}
            onClick={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : mode === 'start' ? (
              t('limitedIrrigation.start')
            ) : (
              t('limitedIrrigation.save')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
