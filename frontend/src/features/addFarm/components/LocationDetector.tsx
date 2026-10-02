import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useResolveAdm4 } from '@/features/addFarm/queries';
import { cn } from '@/lib/utils';
import { NOTICE_CLASSES } from '@/lib/toneClasses';

interface LocationDetectorProps {
  lat: string;
  lng: string;
  onLatChange: (value: string) => void;
  onLngChange: (value: string) => void;
  onAdm4Change: (value: string) => void;
  locationHint: string;
}

const GEOLOCATION_TIMEOUT_MS = 20_000;
// Jeda deteksi otomatis setelah form tampil, supaya prompt izin lokasi tidak muncul sebelum halaman siap.
const AUTO_DETECT_DELAY_MS = 350;

export function LocationDetector({
  lat,
  lng,
  onLatChange,
  onLngChange,
  onAdm4Change,
  locationHint,
}: LocationDetectorProps) {
  const { t } = useTranslation();
  const { mutateAsync: resolveAdm4 } = useResolveAdm4();
  const [detecting, setDetecting] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'error' | 'warning' | '' }>({
    message: '',
    type: '',
  });
  const autoTriggered = useRef(false);

  const detect = useCallback(
    (mode: 'auto' | 'manual') => {
      if (!navigator.geolocation) {
        setStatus({ message: t('farms.addForm.geoUnsupported'), type: 'error' });
        return;
      }
      setDetecting(true);
      setStatus({
        message:
          mode === 'auto' ? t('farms.addForm.geoDetectingAuto') : t('farms.addForm.geoDetecting'),
        type: '',
      });
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const acc = Math.round(pos.coords.accuracy || 0);
          const dLat = Number(pos.coords.latitude.toFixed(6));
          const dLng = Number(pos.coords.longitude.toFixed(6));
          onLatChange(String(dLat));
          onLngChange(String(dLng));
          onAdm4Change('');
          const accText = acc ? `GPS (±${acc}m)` : 'GPS';
          try {
            const res = await resolveAdm4({ lat: dLat, lng: dLng, hint: locationHint });
            if (res.found && res.adm4) {
              onAdm4Change(res.adm4);
              setStatus({
                message: t('farms.addForm.geoSuccess', {
                  lat: dLat,
                  lng: dLng,
                  acc: accText,
                  adm4: res.adm4,
                }),
                type: '',
              });
            } else {
              onAdm4Change('');
              setStatus({
                message: t('farms.addForm.geoNoAdm4'),
                type: 'warning',
              });
            }
          } catch {
            setStatus({
              message: t('farms.addForm.geoResolverError'),
              type: 'warning',
            });
          } finally {
            setDetecting(false);
          }
        },
        (err) => {
          const geoErrors: Record<number, string> = {
            1: t('farms.addForm.geoError1'),
            2: t('farms.addForm.geoError2'),
            3: t('farms.addForm.geoError3'),
          };
          setStatus({
            message: geoErrors[err.code] || t('farms.addForm.geoErrorFallback'),
            type: 'error',
          });
          setDetecting(false);
        },
        { timeout: GEOLOCATION_TIMEOUT_MS, enableHighAccuracy: true, maximumAge: 0 },
      );
    },
    [locationHint, onLatChange, onLngChange, onAdm4Change, resolveAdm4, t],
  );

  // Deteksi otomatis sekali saat halaman dibuka kalau koordinat masih kosong (perilaku versi lama).
  useEffect(() => {
    if (autoTriggered.current) return;
    autoTriggered.current = true;
    const h = window.setTimeout(() => {
      if (!lat && !lng) detect('auto');
    }, AUTO_DETECT_DELAY_MS);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusColor =
    status.type === 'error'
      ? 'text-destructive'
      : status.type === 'warning'
        ? NOTICE_CLASSES.warningText
        : 'text-muted-foreground';

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="farm-lat">{t('farms.addForm.latLabel')}</Label>
          <Input
            id="farm-lat"
            type="number"
            step="any"
            min={-90}
            max={90}
            placeholder={t('farms.addForm.latPlaceholder')}
            value={lat}
            onChange={(e) => {
              onLatChange(e.target.value);
              onAdm4Change('');
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="farm-lng">{t('farms.addForm.lngLabel')}</Label>
          <Input
            id="farm-lng"
            type="number"
            step="any"
            min={-180}
            max={180}
            placeholder={t('farms.addForm.lngPlaceholder')}
            value={lng}
            onChange={(e) => {
              onLngChange(e.target.value);
              onAdm4Change('');
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => detect('manual')}
          disabled={detecting}
        >
          <MapPin className="size-4" /> {t('farms.addForm.detectBtn')}
        </Button>
        {status.message && (
          <p className={cn('text-sm', statusColor)} aria-live="polite">
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}
