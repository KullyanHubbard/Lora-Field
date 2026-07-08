import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

interface SelectFarmsAddButtonProps {
  onAddFarm: () => void;
}

export function SelectFarmsAddButton({ onAddFarm }: SelectFarmsAddButtonProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onAddFarm}
      className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Plus className="size-4" />
      {t('farms.addForm.pageTitle')}
    </button>
  );
}
