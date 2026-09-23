import { Skeleton } from '@/components/ui/skeleton';

export function SelectFarmsLoadingState() {
  return (
    <div className="w-full rounded-xl border border-border p-4 sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <Skeleton className="h-[320px] w-full rounded-xl sm:h-[420px] lg:h-[560px] lg:w-1/2" />
        <div className="space-y-4 lg:w-1/2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
