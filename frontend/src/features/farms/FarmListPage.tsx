import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useFarms } from './queries';
import { FarmMap } from './components/FarmMap';
import { formatCoords } from '@/lib/format';
import { DashboardBar } from '@/components/layout/DashboardBar';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill, type PillTone } from '@/components/ui/status-pill';

function farmStatusPill(
  status: string,
  t: (key: string) => string,
): { tone: PillTone; label: string } {
  switch (status) {
    case 'active':
      return { tone: 'green', label: t('farmStatus.active') };
    case 'warning':
      return { tone: 'yellow', label: t('farmStatus.warning') };
    case 'maintenance':
      return { tone: 'yellow', label: t('farmStatus.maintenance') };
    case 'inactive':
    case 'offline':
      return { tone: 'neutral', label: t('farmStatus.inactive') };
    default:
      return {
        tone: 'neutral',
        label: status ? status.charAt(0).toUpperCase() + status.slice(1) : t('farmStatus.unknown'),
      };
  }
}

// Ambang panjang teks lokasi: di atas ini, subteks daftar kebun memakai koordinat.
const LOCATION_MAX_LEN = 40;

export default function FarmListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data, isLoading, error } = useFarms();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <DashboardBar />
        <div className="mx-auto w-full rounded-xl border border-border p-4 sm:p-6 lg:w-[85%]">
          <div className="flex flex-col gap-6 lg:flex-row">
            <Skeleton className="h-[520px] w-full rounded-xl lg:w-1/2" />
            <div className="space-y-4 lg:w-1/2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <DashboardBar />
        <p className="text-destructive">{t('dashboard.errorLoad', { message: error.message })}</p>
      </div>
    );
  }

  const farms = data?.items ?? [];

  const openFarm = (id: string) => navigate(`/farms/${id}`);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <DashboardBar />
      <div className="mx-auto w-full rounded-xl border border-border p-4 sm:p-6 lg:w-[85%]">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Peta kiri — dibungkus frame abu-abu tipis (sewarna card kebun) agar
              tepi peta tidak terlihat sebagai garis putih. */}
          <div className="rounded-xl border border-border bg-muted/40 p-1.5 lg:w-1/2">
            <FarmMap farms={farms} />
          </div>

          {/* Daftar kebun kanan — kotak abu-abu (sewarna frame peta). */}
          <div className="lg:w-1/2">
            <div className="rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
              <h2 className="mb-3 text-sm font-semibold text-primary">{t('dashboard.title')}</h2>
              <div className="divide-y divide-border">
                {farms.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">{t('dashboard.empty')}</p>
                ) : (
                  farms.map((farm) => {
                    const pill = farmStatusPill(farm.status, t);
                    // Lokasi > 40 karakter ditampilkan sebagai koordinat supaya subteks ringkas.
                    const locationLabel =
                      farm.location.length > LOCATION_MAX_LEN
                        ? formatCoords(farm.latitude, farm.longitude)
                        : farm.location;
                    const subtext = [farm.crop_type, locationLabel].filter(Boolean).join(' · ');
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
                            {subtext || '—'}
                          </p>
                        </div>
                        <StatusPill tone={pill.tone} label={pill.label} />
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
                className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="size-4" />
                {t('farms.addForm.pageTitle')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
