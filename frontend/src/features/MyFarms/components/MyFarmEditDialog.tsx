import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
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

interface MyFarmEditDialogProps {
  farm: Farm | null;
  isUpdating: boolean;
  onClose: () => void;
  onConfirm: (newName: string) => void;
}

export function MyFarmEditDialog({
  farm,
  isUpdating,
  onClose,
  onConfirm,
}: MyFarmEditDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  if (farm && name === '') {
    setName(farm.name);
  }

  if (!farm) return null;

  const handleConfirm = () => {
    if (name.trim()) {
      onConfirm(name.trim());
    }
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  return (
    <AlertDialog open={farm != null} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('myFarms.editDialogTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('myFarms.editDialogDesc', { name: farm.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('myFarms.editDialogPlaceholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
          }}
          autoFocus
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUpdating}>{t('myFarms.editDialogCancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isUpdating || !name.trim() || name.trim() === farm.name}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
          >
            {isUpdating ? <Loader2 className="size-4 animate-spin" /> : t('myFarms.editDialogSave')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
