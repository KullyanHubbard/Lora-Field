import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Info, Plus, Radio } from 'lucide-react';
import { useAddFarm } from '@/features/addFarm/hooks';
import { CropDropdown, LocationDetector } from '@/features/addFarm/components';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NOTICE_CLASSES } from '@/lib/toneClasses';
import { cn } from '@/lib/utils';
import { FARM_FIELD_MAX_LENGTH } from '@/lib/fieldLimits';

export default function AddFarmPage() {
  const { t } = useTranslation();
  const {
    name,
    setName,
    owner,
    setOwner,
    location,
    setLocation,
    cropType,
    setCropType,
    areaHa,
    setAreaHa,
    lat,
    setLat,
    lng,
    setLng,
    adm4,
    setAdm4,
    gatewayDeviceId,
    setGatewayDeviceId,
    gatewayDisplayName,
    setGatewayDisplayName,
    missingFields,
    feedback,
    busy,
    submitLabel,
    submit,
  } = useAddFarm();

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">{t('farms.addForm.pageTitle')}</CardTitle>
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
                maxLength={FARM_FIELD_MAX_LENGTH.name}
                placeholder={t('farms.addForm.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="farm-owner">{t('farms.addForm.ownerLabel')}</Label>
              <Input
                id="farm-owner"
                maxLength={FARM_FIELD_MAX_LENGTH.owner}
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
                maxLength={FARM_FIELD_MAX_LENGTH.location}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="farm-area">{t('farms.addForm.areaLabel')}</Label>
              <Input
                id="farm-area"
                type="text"
                inputMode="decimal"
                placeholder={t('farms.addForm.areaPlaceholder')}
                value={areaHa}
                onChange={(e) => setAreaHa(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('farms.addForm.areaHelper')}</p>
            </div>
          </div>

          <p className="pt-1 text-sm font-medium text-muted-foreground">
            {t('farms.addForm.sectionGateway')}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="farm-gateway">{t('farms.addForm.gatewayIdLabel')}</Label>
              <Input
                id="farm-gateway"
                maxLength={FARM_FIELD_MAX_LENGTH.gatewayDeviceId}
                placeholder={t('farms.addForm.gatewayIdPlaceholder')}
                value={gatewayDeviceId}
                onChange={(e) => setGatewayDeviceId(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="farm-gateway-name">
                {t('farms.addForm.gatewayDisplayNameLabel')}
              </Label>
              <Input
                id="farm-gateway-name"
                maxLength={FARM_FIELD_MAX_LENGTH.gatewayDisplayName}
                placeholder={t('farms.addForm.gatewayDisplayNamePlaceholder')}
                value={gatewayDisplayName}
                onChange={(e) => setGatewayDisplayName(e.target.value)}
              />
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Radio className="size-3.5" /> {t('farms.addForm.gatewayHint')}
          </p>

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
            <div
              className={cn(
                'flex items-start gap-2 rounded-md border p-3 text-sm',
                NOTICE_CLASSES.warningBorder,
                NOTICE_CLASSES.warningText,
              )}
            >
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
            <Button type="submit" disabled={busy}>
              <Plus className="size-4" /> {submitLabel}
            </Button>
            <Button asChild variant="outline">
              <Link to="/select-farms">{t('farms.addForm.cancel')}</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
