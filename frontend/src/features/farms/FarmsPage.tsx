import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useFarms } from './queries';
import { formatAreaHa, timeAgo } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill, type PillTone } from '@/components/ui/status-pill';
import type { Farm } from '@/types';

// Mapping status farm — konsisten dengan Dashboard (FarmListPage).
// active=hijau; warning/maintenance=kuning; sisanya neutral (bukan merah, DESIGN.md).
function farmStatusPill(status: string): { tone: PillTone; label: string } {
  switch (status) {
    case 'active':
      return { tone: 'green', label: 'Aktif' };
    case 'warning':
      return { tone: 'yellow', label: 'Perlu Perhatian' };
    case 'maintenance':
      return { tone: 'yellow', label: 'Perawatan' };
    case 'inactive':
    case 'offline':
      return { tone: 'neutral', label: 'Tidak Aktif' };
    default:
      return {
        tone: 'neutral',
        label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Tidak Diketahui',
      };
  }
}

function FarmListCard({ farm }: { farm: Farm }) {
  const pill = farmStatusPill(farm.status);
  return (
    <Link to={`/farms/${farm.id}`}>
      <Card className="h-full p-5 transition-colors hover:bg-accent/50">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <h3 className="font-semibold text-foreground">{farm.name}</h3>
            {farm.owner && <span className="text-xs text-muted-foreground">{farm.owner}</span>}
          </div>
          <StatusPill tone={pill.tone} label={pill.label} />
        </div>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Lokasi</span>
            <span className="max-w-[60%] truncate text-right text-foreground">
              {farm.location || '—'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Komoditas</span>
            <span className="text-foreground">{farm.crop_type || '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Luas Lahan</span>
            <span className="tabular-nums text-foreground">{formatAreaHa(farm.area_ha)}</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Update {timeAgo(farm.updated_at)}</p>
      </Card>
    </Link>
  );
}

export default function FarmsPage() {
  const { data, isLoading, error } = useFarms();
  const [filter, setFilter] = useState('');

  const farms = data?.items ?? [];
  const q = filter.trim().toLowerCase();
  const visibleFarms = q
    ? farms.filter(
        (f) =>
          (f.name || '').toLowerCase().includes(q) ||
          (f.location || '').toLowerCase().includes(q) ||
          (f.crop_type || '').toLowerCase().includes(q),
      )
    : farms;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari kebun, lokasi, atau tanaman"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive">Gagal memuat kebun: {error.message}</p>
      ) : visibleFarms.length === 0 ? (
        <p className="text-muted-foreground">
          {filter ? 'Kebun tidak ditemukan.' : 'Belum ada kebun.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleFarms.map((farm) => (
            <FarmListCard key={farm.id} farm={farm} />
          ))}
        </div>
      )}
    </div>
  );
}
