import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useFarms } from './queries';
import { FarmMap } from './components/FarmMap';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusLights, farmStatusTone } from '@/components/ui/status-lights';

export default function FarmListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data, isLoading, error } = useFarms();

  if (isLoading) {
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

  if (error) {
    return (
      <p className="text-destructive">{t('dashboard.errorLoad', { message: error.message })}</p>
    );
  }

  const farms = data?.items ?? [];

  const openFarm = (id: string) => navigate(`/farms/${id}`);

  return (
    <div className="w-full rounded-xl border border-border p-4 sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Peta kiri — dibungkus frame abu-abu tipis (sewarna card kebun) agar
              tepi peta tidak terlihat sebagai garis putih. */}
          <div className="rounded-xl border border-border bg-muted/40 p-1.5 lg:w-1/2 mb-4 lg:mb-0">
            <FarmMap farms={farms} />
          </div>

          {/* Daftar kebun kanan — kotak abu-abu (sewarna frame peta). */}
          <div className="lg:w-1/2">
            <div className="rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
              <div className="mb-3 flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">
                {t('dashboard.title')}
              </div>
              <div className="divide-y divide-border">
                {farms.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">{t('dashboard.empty')}</p>
                ) : (
                  farms.map((farm) => {
                    const tone = farmStatusTone(farm.status);
                    const shortLocation = farm.location.length > 30
                      ? farm.location.slice(0, 30) + '…'
                      : farm.location;
                    return (
                      <div
                        key={farm.id}
                        onClick={() => openFarm(farm.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') openFarm(farm.id);
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={t('dashboard.openFarm', { name: farm.name })}
                        className="flex cursor-pointer items-start justify-between gap-3 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-foreground">{farm.name}</h3>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {farm.crop_type || '—'}
                          </p>
                          {shortLocation && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {shortLocation}
                            </p>
                          )}
                        </div>
                        <StatusLights tone={tone} />
                      </div>
                    );
                  })
                )}
              </div>

              {/* Kotak "Tambah Kebun" — selalu di paling bawah list; ikut bergeser ke bawah
                setiap kali ada kebun baru karena dirender setelah blok daftar kebun. */}
              <button
                type="button"
                onClick={() => navigate('/farms/add')}
                className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="size-4" />
                {t('farms.addForm.pageTitle')}
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}
