import { Skeleton } from '@/components/ui/skeleton';

export function IrrigationLoadingState() {
  return (
    <div className="flex min-h-screen flex-col gap-4">
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-44 rounded-lg" />
      </div>
    </div>
  );
}
