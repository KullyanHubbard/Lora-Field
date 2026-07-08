import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

// Blok error bersama untuk halaman farm-context (Monitoring, Irigasi, Gateway,
// Node, Riwayat, Cuaca, Detail Kebun). Mengganti pengulangan
// `if (error || !summary) return (...)` di tiap halaman.
//
// `message` = ekspresi i18n yang sudah dipakai tiap halaman (mis.
// `error ? t('monitoring.errorLoadFarm', { message }) : t('monitoring.noData')`).
//
export function FarmSummaryError({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <p className="text-destructive">{message}</p>
      <Button asChild variant="outline" size="sm">
        <Link to="/select-farms">{t('common.backToFarmList')}</Link>
      </Button>
    </div>
  );
}
