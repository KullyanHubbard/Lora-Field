import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFarmSummary } from '@/features/farms/queries';
import { FarmSummaryError } from '@/components/FarmSummaryError';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GatewayInfoContent } from './components/GatewayInfoContent';
import { GatewayLogContent } from './components/GatewayLogContent';

export default function GatewayPage() {
  const { t } = useTranslation();
  const { id: farmId } = useParams();
  const { data: summary, isLoading, error } = useFarmSummary(farmId ?? '');

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-xl mx-auto">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <FarmSummaryError
        message={
          error ? t('gateway.errorLoad', { message: error.message }) : t('gateway.noData')
        }
      />
    );
  }

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      {/* ——— KARTU UTAMA GATEWAY ——— */}
      <GatewayInfoContent
        summary={summary}
        className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/80 p-6 transition-colors"
      />

      {/* ——— RIWAYAT KONEKSI ——— */}
      <Card>
        <GatewayLogContent farmId={farmId} />
      </Card>
    </div>
  );
}
