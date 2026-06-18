import { Link, useParams } from 'react-router-dom';
import { RadioTower, WifiOff } from 'lucide-react';
import { useFarmSummary } from '@/features/farms/queries';
import { getFarmLastUpdate } from '@/features/farms/farmHelpers';
import { getGatewayStatusBadge } from '@/lib/status';
import { timeAgo } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{children}</span>
    </div>
  );
}

export default function GatewayPage() {
  const { id: farmId } = useParams();
  const { data: summary, isLoading, error } = useFarmSummary(farmId ?? '');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-56 w-full max-w-xl" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="space-y-3">
        <p className="text-destructive">
          {error ? `Gagal memuat data gateway: ${error.message}` : 'Data tidak tersedia.'}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">Kembali ke Daftar Kebun</Link>
        </Button>
      </div>
    );
  }

  const gwBadge = getGatewayStatusBadge(summary.gateway_status);
  const isOffline = summary.gateway_status === 'offline';
  const GwIcon = isOffline ? WifiOff : RadioTower;
  const gatewayId = `gw-${summary.farm.id}`;
  const nodesTotal = summary.nodes.length;
  const nodesActive = summary.nodes.filter((ns) => ns.node.status !== 'offline').length;
  const lastSeen = getFarmLastUpdate(summary.farm, summary.nodes);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RadioTower className="size-4 text-primary" /> Gateway
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-2 py-2">
          <GwIcon className="size-12 text-muted-foreground" />
          <StatusBadge label={gwBadge.label} tone={gwBadge.tone} />
        </div>
        <div>
          <InfoRow label="ID Gateway">
            <span className="font-mono">{gatewayId}</span>
          </InfoRow>
          <InfoRow label="Node Aktif">
            {nodesActive}/{nodesTotal}
          </InfoRow>
          <InfoRow label="Terakhir Terlihat">{timeAgo(lastSeen)}</InfoRow>
        </div>
      </CardContent>
    </Card>
  );
}
