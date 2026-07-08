import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { useCrops } from '@/features/dashboard/queries';
import type { Crop } from '@/types';

interface CropDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export function CropDropdown({ value, onChange }: CropDropdownProps) {
  const { t } = useTranslation();
  const { data } = useCrops();
  const crops = data?.crops ?? [];
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Crop | null>(null);

  const filter = value.toLowerCase();
  const filtered = filter ? crops.filter((c) => c.name.toLowerCase().includes(filter)) : crops;
  const visible = filtered.slice(0, 12);
  const showDropdown = open && visible.length > 0;

  return (
    <div className="relative">
      <Input
        id="farm-crop-input"
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        placeholder={t('farms.addForm.cropPlaceholder')}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setPicked(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 160)}
      />
      {showDropdown && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover py-1 shadow-md"
        >
          {visible.map((crop) => (
            <li
              key={crop.name}
              role="option"
              aria-selected={picked?.name === crop.name}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(crop.name);
                setPicked(crop);
                setOpen(false);
              }}
            >
              {crop.name}
            </li>
          ))}
        </ul>
      )}
      {picked && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t('farms.addForm.cropThreshold', {
            lower: picked.lower_threshold,
            upper: picked.upper_threshold,
          })}
        </p>
      )}
    </div>
  );
}
