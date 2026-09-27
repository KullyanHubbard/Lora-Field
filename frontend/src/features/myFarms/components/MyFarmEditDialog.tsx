import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { GROUND_COVER_OPTIONS } from '@/lib/groundCover';
import type { Farm, GroundCover } from '@/types';

export interface MyFarmEditPayload {
  name?: string;
  ground_cover?: GroundCover;
}

interface MyFarmEditDialogProps {
  farm: Farm | null;
  isUpdating: boolean;
  onClose: () => void;
  onConfirm: (payload: MyFarmEditPayload) => void;
}

export function MyFarmEditDialog({ farm, isUpdating, onClose, onConfirm }: MyFarmEditDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(farm?.name ?? '');
  const [groundCover, setGroundCover] = useState<GroundCover>(farm?.ground_cover ?? 'open');

  if (!farm) return null;

  const trimmedName = name.trim();
  const nameChanged = trimmedName !== '' && trimmedName !== farm.name;
  const groundCoverChanged = groundCover !== farm.ground_cover;

  const handleConfirm = () => {
    if (!nameChanged && !groundCoverChanged) return;
    const payload: MyFarmEditPayload = {};
    if (nameChanged) payload.name = trimmedName;
    if (groundCoverChanged) payload.ground_cover = groundCover;
    onConfirm(payload);
  };

  return (
    <AlertDialog
      open={farm != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
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
        <div className="space-y-1.5">
          <Label htmlFor="my-farm-edit-ground-cover">{t('groundCover.label')}</Label>
          <Select
            value={groundCover}
            onValueChange={(value) => setGroundCover(value as GroundCover)}
          >
            <SelectTrigger id="my-farm-edit-ground-cover" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUND_COVER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(`groundCover.${option.value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUpdating}>
            {t('myFarms.editDialogCancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isUpdating || (!nameChanged && !groundCoverChanged)}
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
