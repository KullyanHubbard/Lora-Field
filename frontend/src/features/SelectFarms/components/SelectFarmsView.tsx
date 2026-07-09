import { useTranslation } from 'react-i18next';
import { SelectFarmsLoadingState } from './SelectFarmsLoadingState';
import { SelectFarmsMap } from './SelectFarmsMap';
import type { Farm } from '@/types';

interface SelectFarmsViewProps {
  farms: Farm[];
  isLoading: boolean;
  error: Error | null;
}

export function SelectFarmsView({
  farms,
  isLoading,
  error,
}: SelectFarmsViewProps) {
  const { t } = useTranslation();

  if (isLoading) return <SelectFarmsLoadingState />;

  if (error) {
    return (
      <p className="text-destructive">{t('selectFarms.errorLoad', { message: error.message })}</p>
    );
  }

  return (
    <div className="w-full rounded-xl border border-border p-4 sm:p-6">
      <div className="rounded-xl border border-border bg-muted/40 p-1.5">
        <SelectFarmsMap farms={farms} />
      </div>
    </div>
  );
}
