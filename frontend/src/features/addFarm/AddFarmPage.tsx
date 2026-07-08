import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Info, Plus } from 'lucide-react';
import { useAddFarm } from '@/features/addFarm/hooks';
import { CropDropdown, LocationDetector } from '@/features/addFarm/components';
import { DashboardBar } from '@/components/layout/DashboardBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    missingFields,
    feedback,
    busy,
    submitLabel,
    submit,
  } = useAddFarm();

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <DashboardBar title="Registrasi Kebun" />
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Button asChild variant="ghost" size="icon" className="size-7">
              <Link to="/select-farms" aria-label={t('farms.addForm.backLabel')}>
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
    </div>
  );
}
