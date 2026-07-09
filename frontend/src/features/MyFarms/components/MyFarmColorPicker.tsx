import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { MARKER_COLORS, type MarkerColorId } from '../farmColorStorage';

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
  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Pilih Warna Marker</SheetTitle>
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{farmName}</p>
        </SheetHeader>
        <div className="mt-6 grid grid-cols-1 gap-3">
          {MARKER_COLORS.map((color) => (
            <button
              key={color.id}
              onClick={() => onColorChange(color.id)}
              className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
            >
              <span
                className="size-6 rounded-full"
                style={{ backgroundColor: color.value }}
              />
              <span className="text-sm font-medium">{color.label}</span>
              {currentColor === color.id && (
                <span className="ml-auto text-primary">✓</span>
              )}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
