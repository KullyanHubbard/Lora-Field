import { Link2, Radio, Unlink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { getGatewayStatusBadge } from '@/lib/status';
import { timeAgo } from '@/lib/format';
import type { FarmGateway } from '@/types';
import { isFarmGatewayOnline } from '@/features/gateway/gatewayHelpers';

type GatewayProvisioningCardProps = {
  farmGateway: FarmGateway | null;
  farmGatewayError: Error | null;
  isFarmGatewayLoading: boolean;
  gatewayDeviceId: string;
  onGatewayDeviceIdChange: (value: string) => void;
  gatewayDisplayName: string;
  onGatewayDisplayNameChange: (value: string) => void;
  onClaimGateway: () => Promise<void>;
  onUnclaimGateway: () => Promise<void>;
  isClaimingGateway: boolean;
  isUnclaimingGateway: boolean;
};

export function GatewayProvisioningCard({
  farmGateway,
  farmGatewayError,
  isFarmGatewayLoading,
  gatewayDeviceId,
  onGatewayDeviceIdChange,
  gatewayDisplayName,
  onGatewayDisplayNameChange,
  onClaimGateway,
  onUnclaimGateway,
  isClaimingGateway,
  isUnclaimingGateway,
}: GatewayProvisioningCardProps) {
  const { t } = useTranslation();

  if (isFarmGatewayLoading) {
    return (
      <Card>
        <CardHeader className="px-4 py-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (farmGatewayError) {
    return (
      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Radio className="size-3.5 text-muted-foreground" />
            {t('gateway.connectionTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-sm text-destructive">
            {t('gateway.connectionLoadError', { message: farmGatewayError.message })}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (farmGateway) {
    const status = getGatewayStatusBadge(isFarmGatewayOnline(farmGateway) ? 'online' : 'offline');
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Radio className="size-3.5 text-muted-foreground" />
            {t('gateway.connectionTitle')}
          </CardTitle>
          <StatusPill tone={status.tone} label={t(status.labelKey)} />
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">{t('gateway.displayName')}</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {farmGateway.display_name || t('gateway.unnamedGateway')}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('gateway.idLabel')}</p>
              <p className="mt-1 font-mono text-sm text-foreground">{farmGateway.device_id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('gateway.claimedAt')}</p>
              <p className="mt-1 text-sm text-foreground">
                {farmGateway.claimed_at ? timeAgo(farmGateway.claimed_at, t) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('gateway.lastSeenShort')}</p>
              <p className="mt-1 text-sm text-foreground">
                {farmGateway.last_seen_at ? timeAgo(farmGateway.last_seen_at, t) : '-'}
              </p>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isUnclaimingGateway}>
                <Unlink className="size-4" /> {t('gateway.unclaim')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('gateway.unclaimTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('gateway.unclaimDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('gateway.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={() => void onUnclaimGateway()}>
                  {t('gateway.unclaimConfirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Radio className="size-3.5 text-muted-foreground" />
          {t('gateway.connectionTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="gateway-device-id">{t('gateway.idLabel')}</Label>
            <Input
              id="gateway-device-id"
              maxLength={64}
              placeholder={t('gateway.deviceIdPlaceholder')}
              value={gatewayDeviceId}
              onChange={(event) => onGatewayDeviceIdChange(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gateway-display-name">{t('gateway.displayName')}</Label>
            <Input
              id="gateway-display-name"
              maxLength={100}
              placeholder={t('gateway.displayNamePlaceholder')}
              value={gatewayDisplayName}
              onChange={(event) => onGatewayDisplayNameChange(event.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">{t('gateway.manualGatewayHint')}</p>

          <Button
            type="button"
            disabled={!gatewayDeviceId.trim() || isClaimingGateway}
            onClick={() => void onClaimGateway()}
            className="w-fit"
          >
            <Link2 className="size-4" /> {t('gateway.claim')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
