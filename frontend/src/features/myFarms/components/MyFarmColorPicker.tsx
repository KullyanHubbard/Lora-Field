import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MARKER_COLORS, type MarkerColorId } from '@/features/myFarms/farmColorStorage';

interface MyFarmColorPickerProps {
  farmName: string;
  isOpen: boolean;
  currentColor: MarkerColorId;
  onColorChange: (colorId: MarkerColorId) => void;
  onClose: () => void;
}

export function MyFarmColorPicker({
  farmName,
  isOpen,
  currentColor,
  onColorChange,
  onClose,
}: MyFarmColorPickerProps) {
  const { t } = useTranslation();

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent>
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>{t('myFarms.colorPickerTitle')}</SheetTitle>
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{farmName}</p>
        </SheetHeader>
        <div className="mt-6 grid grid-cols-2 gap-2">
          {MARKER_COLORS.map((color) => (
            <button
              key={color.id}
              onClick={() => onColorChange(color.id)}
              className="relative flex flex-col items-center gap-2 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
            >
              <span
                className="size-8 rounded-full shadow-sm"
                style={{ backgroundColor: color.value }}
              />
              <span className="text-xs font-medium text-center">
                {t(`markerColor.${color.id}`)}
              </span>
              {currentColor === color.id && (
                <span className="absolute right-2 top-2 text-primary">✓</span>
              )}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
