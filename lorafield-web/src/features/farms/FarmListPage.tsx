import { Link } from 'react-router-dom';
import { useFarms } from './queries';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function FarmListPage() {
  const { data, isLoading, error } = useFarms();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive">Gagal memuat farm: {error.message}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {data?.items.map((farm) => (
        <Link key={farm.id} to={`/farms/${farm.id}`}>
          <Card className="p-4 transition hover:border-primary">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{farm.name}</h3>
              <Badge>{farm.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{farm.location}</p>
            <p className="mt-2 text-sm">
              {farm.crop_type} • {farm.area_ha} ha
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
