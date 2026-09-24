import { Skeleton } from '@/components/ui/skeleton';

// Bentuk sama dengan SelectFarmsView: satu peta penuh.
export function SelectFarmsLoadingState() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Skeleton className="min-h-[320px] flex-1 rounded-xl" />
    </div>
  );
}
