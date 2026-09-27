import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCrops } from '@/features/dashboard/queries';

interface CropDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

// Jenis tanaman wajib dipilih dari daftar GET /api/crops, tanpa ketik bebas,
// karena threshold irigasi kebun diambil dari tanaman yang dipilih.
export function CropDropdown({ value, onChange }: CropDropdownProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useCrops();
  const crops = data?.crops ?? [];
  const picked = crops.find((crop) => crop.name === value) ?? null;

  return (
    <div>
      <Select value={value} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger id="farm-crop-input" className="w-full">
          <SelectValue placeholder={t('farms.addForm.cropPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {crops.map((crop) => (
            <SelectItem key={crop.name} value={crop.name}>
              {crop.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isError && (
        <p className="mt-1.5 text-xs text-destructive">
          {t('farms.addForm.cropLoadError')}{' '}
          <button
            type="button"
            className="font-medium underline underline-offset-2 outline-none"
            onClick={() => void refetch()}
          >
            {t('farms.addForm.cropRetry')}
          </button>
        </p>
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
