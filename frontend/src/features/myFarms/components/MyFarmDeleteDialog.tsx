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
import type { Farm } from '@/types';

interface MyFarmDeleteDialogProps {
  farm: Farm | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function MyFarmDeleteDialog({
  farm,
  isDeleting,
  onClose,
  onConfirm,
}: MyFarmDeleteDialogProps) {
  const { t } = useTranslation();

  if (!farm) return null;

  return (
    <AlertDialog open={farm != null} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('farms.deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('farms.deleteDescription', { name: farm.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {t('farms.deleteCancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            data-variant="destructive"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {t('farms.deleteConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
