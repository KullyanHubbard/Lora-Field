import { SelectFarmsLoadingState } from './SelectFarmsLoadingState';
import { SelectFarmsMap } from './SelectFarmsMap';
import type { Farm } from '@/types';

interface SelectFarmsViewProps {
  farms: Farm[];
  isLoading: boolean;
  error: Error | null;
}

export function SelectFarmsView({ farms, isLoading, error }: SelectFarmsViewProps) {
  if (isLoading) return <SelectFarmsLoadingState />;

  if (error) {
    return <p className="p-4 text-destructive">{error.message}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 rounded-xl border border-border bg-muted/40">
        <SelectFarmsMap farms={farms} />
      </div>
    </div>
  );
}
