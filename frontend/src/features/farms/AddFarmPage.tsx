import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Info, MapPin, Plus } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useCrops, useCreateFarm, useFarms } from './queries';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DashboardBar } from '@/components/layout/DashboardBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Crop } from '@/types';

function CropDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useCrops();
  const { t } = useTranslation();
  const crops = data?.crops ?? [];
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Crop | null>(null);

  const filter = value.toLowerCase();
  const filtered = filter ? crops.filter((c) => c.name.toLowerCase().includes(filter)) : crops;
  const visible = filtered.slice(0, 12);
  const showDropdown = open && visible.length > 0;

  return (
    <div className="relative">
      <Input
        id="farm-crop-input"
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        placeholder={t('farms.addForm.cropPlaceholder')}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setPicked(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 160)}
      />
      {showDropdown && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover py-1 shadow-md"
        >
          {visible.map((crop) => (
            <li
              key={crop.name}
              role="option"
              aria-selected={picked?.name === crop.name}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(crop.name);
                setPicked(crop);
                setOpen(false);
              }}
            >
              {crop.name}
            </li>
          ))}
        </ul>
      )}
      {picked && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t('farms.addForm.cropThreshold', {
            lower: picked.lower_threshold,
            upper: picked.upper_threshold,
          })}
        </p>
      )}
    </div>
  );
}

function LocationDetector({
  lat,
  lng,
  onLatChange,
  onLngChange,
  onAdm4Change,
  locationHint,
}: {
  lat: string;
  lng: string;
  onLatChange: (v: string) => void;
  onLngChange: (v: string) => void;
  onAdm4Change: (v: string) => void;
  locationHint: string;
}) {
  const { t } = useTranslation();
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
            const res = await api.resolveAdm4(dLat, dLng, locationHint);
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
        { timeout: 20000, enableHighAccuracy: true, maximumAge: 0 },
      );
    },
    [locationHint, onLatChange, onLngChange, onAdm4Change, t],
  );

  // Auto-detect sekali saat mount kalau koordinat masih kosong (perilaku lama).
  useEffect(() => {
    if (autoTriggered.current) return;
    autoTriggered.current = true;
    const h = window.setTimeout(() => {
      if (!lat && !lng) detect('auto');
    }, 350);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusColor =
    status.type === 'error'
      ? 'text-destructive'
      : status.type === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
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

export default function AddFarmPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { data: farmsData } = useFarms();
  const createFarm = useCreateFarm();

  const [name, setName] = useState('');
  const [owner, setOwner] = useState(user?.name ?? '');
  const [location, setLocation] = useState('');
  const [cropType, setCropType] = useState('');
  const [areaHa, setAreaHa] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [adm4, setAdm4] = useState('');
  const [forceSubmit, setForceSubmit] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');

  const existingCount = farmsData?.items.length ?? 0;

  const submit = async () => {
    setFeedback('');

    const rawName = name.trim();
    const effectiveName = rawName || t('farms.addForm.defaultName', { count: existingCount + 1 });
    if (!rawName) setName(effectiveName);

    const trimmedLocation = location.trim();
    const trimmedCrop = cropType.trim();

    const missing: string[] = [];
    if (!trimmedLocation) missing.push(t('farms.addForm.fieldLocation'));
    if (!trimmedCrop) missing.push(t('farms.addForm.fieldCrop'));
    if (areaHa === '') missing.push(t('farms.addForm.fieldArea'));
    if (missing.length && !forceSubmit) {
      setMissingFields(missing);
      setForceSubmit(true);
      return;
    }
    setMissingFields([]);

    const parsedLat = lat !== '' ? parseFloat(lat) : NaN;
    const parsedLng = lng !== '' ? parseFloat(lng) : NaN;
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setFeedback(t('farms.addForm.errorNoCoords'));
      return;
    }

    let resolvedAdm4 = adm4.trim();
    if (!resolvedAdm4) {
      try {
        const res = await api.resolveAdm4(parsedLat, parsedLng, trimmedLocation);
        resolvedAdm4 = res.found && res.adm4 ? res.adm4 : '';
      } catch {
        resolvedAdm4 = '';
      }
    }
    if (!resolvedAdm4) {
      setFeedback(t('farms.addForm.errorNoAdm4'));
      return;
    }

    createFarm.mutate({
      name: effectiveName,
      owner: owner.trim(),
      location: trimmedLocation,
      crop_type: trimmedCrop,
      area_ha: areaHa !== '' ? parseFloat(areaHa) : null,
      bmkg_adm4_code: resolvedAdm4,
      latitude: parsedLat,
      longitude: parsedLng,
    });
  };

  const submitLabel =
    forceSubmit && missingFields.length
      ? t('farms.addForm.submitForce')
      : t('farms.addForm.submit');

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <DashboardBar />
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Button asChild variant="ghost" size="icon" className="size-7">
              <Link to="/dashboard" aria-label={t('farms.addForm.backLabel')}>
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            {t('farms.addForm.pageTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            noValidate
            className="space-y-5"
          >
            <p className="text-sm font-medium text-muted-foreground">
              {t('farms.addForm.sectionProfile')}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="farm-name">{t('farms.addForm.nameLabel')}</Label>
                <Input
                  id="farm-name"
                  maxLength={100}
                  placeholder={t('farms.addForm.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="farm-owner">{t('farms.addForm.ownerLabel')}</Label>
                <Input
                  id="farm-owner"
                  maxLength={100}
                  placeholder={t('farms.addForm.ownerPlaceholder')}
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="farm-location">{t('farms.addForm.locationLabel')}</Label>
                <Input
                  id="farm-location"
                  maxLength={200}
                  placeholder={t('farms.addForm.locationPlaceholder')}
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    if (adm4) setAdm4('');
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="farm-crop-input">{t('farms.addForm.cropLabel')}</Label>
                <CropDropdown value={cropType} onChange={setCropType} />
              </div>
            </div>

            <div className="space-y-1.5 sm:max-w-[50%]">
              <Label htmlFor="farm-area">{t('farms.addForm.areaLabel')}</Label>
              <Input
                id="farm-area"
                type="number"
                min={0}
                step="0.01"
                placeholder={t('farms.addForm.areaPlaceholder')}
                value={areaHa}
                onChange={(e) => setAreaHa(e.target.value)}
              />
            </div>

            <p className="pt-1 text-sm font-medium text-muted-foreground">
              {t('farms.addForm.sectionCoords')}
            </p>

            <LocationDetector
              lat={lat}
              lng={lng}
              onLatChange={setLat}
              onLngChange={setLng}
              onAdm4Change={setAdm4}
              locationHint={location}
            />

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3.5" /> {t('farms.addForm.coordsHint')}
            </p>

            {missingFields.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/50 p-3 text-sm text-amber-600 dark:text-amber-400">
                <Info className="mt-0.5 size-4 shrink-0" />
                <div>
                  <strong>{t('farms.addForm.missingTitle')}</strong> {missingFields.join(', ')}{' '}
                  {t('farms.addForm.missingBody')}
                </div>
              </div>
            )}

            {feedback && (
              <p className="text-sm text-destructive" role="status" aria-live="polite">
                {feedback}
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={createFarm.isPending}>
                <Plus className="size-4" /> {submitLabel}
              </Button>
              <Button asChild variant="outline">
                <Link to="/dashboard">{t('farms.addForm.cancel')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
