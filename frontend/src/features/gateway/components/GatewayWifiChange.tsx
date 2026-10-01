import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Wifi } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useRequestGatewayWifiPortal } from '@/features/gateway/queries';

// Tombol "Ganti WiFi": gateway membuka portal WiFi (hotspot) selama 5 menit. WiFi lama tetap tersimpan,
// jadi kalau petani tidak jadi mengganti, gateway kembali ke WiFi lama.
export function GatewayWifiChange({ farmId, portalSsid }: { farmId: string; portalSsid: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const request = useRequestGatewayWifiPortal(farmId);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Wifi className="size-4" />
        {t('gateway.changeWifi')}
      </Button>

      {open && (
        <AlertDialog open onOpenChange={(next) => !next && setOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('gateway.changeWifiTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('gateway.changeWifiDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground">
              <li>{t('gateway.changeWifiStep1', { ssid: portalSsid })}</li>
              <li>{t('gateway.changeWifiStep2')}</li>
              <li>{t('gateway.changeWifiStep3')}</li>
            </ol>
            <p className="text-sm text-muted-foreground">{t('gateway.changeWifiFallback')}</p>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={request.isPending}>{t('gateway.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                disabled={request.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  request.mutate(undefined, { onSuccess: () => setOpen(false) });
                }}
              >
                {request.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  t('gateway.changeWifiConfirm')
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
