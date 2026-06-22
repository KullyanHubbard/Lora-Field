import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFarms } from './queries';
import { FarmMap } from './components/FarmMap';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill, type PillTone } from '@/components/ui/status-pill';

function farmStatusPill(status: string, t: (key: string) => string): { tone: PillTone; label: string } {
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

export default function FarmListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data, isLoading, error } = useFarms();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[420px] w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive">{t('dashboard.errorLoad', { message: error.message })}</p>;
  }

  const farms = data?.items ?? [];

  const openFarm = (id: string) => navigate(`/farms/${id}`);

  return (
    <div className="space-y-6">
      <FarmMap farms={farms} />

      {farms.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          {t('dashboard.empty')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {farms.map((farm) => {
            const pill = farmStatusPill(farm.status, t);
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
                className="cursor-pointer rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-foreground">{farm.name}</h3>
                  <StatusPill tone={pill.tone} label={pill.label} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{farm.crop_type || '—'}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
