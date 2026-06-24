import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Cloud,
  CloudLightning,
  CloudOff,
  CloudRain,
  CloudRainWind,
  CloudSun,
  Cpu,
  Droplet,
  Droplets,
  LineChart,
  Pencil,
  RadioTower,
  Sun,
  Thermometer,
  TriangleAlert,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useFarmSummary } from './queries';
import { useUpdateFarm } from './queries';
import { valveKeyFromDecision } from './farmHelpers';
import {
  getGatewayStatusBadge,
  getIrrigationStatusBadge,
  getNodeStatusBadge,
  getSoilStatusFromMoisture,
  getValveStatusBadge,
} from '@/lib/status';
import { DEG_C, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getWeatherInfo, type WeatherIconKey } from '@/features/weather/weatherHelpers';
import { StatCard } from '@/components/ui/stat-card';
import { StatusPill, type PillTone } from '@/components/ui/status-pill';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { FarmSummary, NodeSummary } from '@/types';

type Pill = { label: string; tone: PillTone };

// ─── EditFarmSheet ────────────────────────────────────────────────────────────

interface EditFarmFields {
  name: string;
  owner: string;
  location: string;
  crop_type: string;
  area_ha: string;
}

function EditFarmSheet({ farmId, farm, open, onOpenChange }: {
  farmId: string;
  farm: FarmSummary['farm'];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  // key di EditFarmForm dibuat dari `open`: tiap sheet dibuka, komponen remount
  // dan state form ter-reset fresh, jadi tidak perlu setState di dalam useEffect.
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('farms.editForm.title')}</SheetTitle>
        </SheetHeader>
        <EditFarmForm
          key={String(open)}
          farmId={farmId}
          farm={farm}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function EditFarmForm({
  farmId,
  farm,
  onClose,
}: {
  farmId: string;
  farm: FarmSummary['farm'];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { mutate, isPending } = useUpdateFarm(farmId);

  const [fields, setFields] = useState<EditFarmFields>({
    name: farm.name ?? '',
    owner: farm.owner ?? '',
    location: farm.location ?? '',
    crop_type: farm.crop_type ?? '',
    area_ha: farm.area_ha != null ? String(farm.area_ha) : '',
  });
  const [nameError, setNameError] = useState('');

  const set = (key: keyof EditFarmFields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields((prev) => ({ ...prev, [key]: e.target.value }));
    if (key === 'name') setNameError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = fields.name.trim();
    if (trimmedName.length < 2) {
      setNameError(t('farms.editForm.errorNameTooShort'));
      return;
    }

    // Kirim hanya field yang berubah dari nilai asli (partial update).
    const payload: Record<string, string | number> = {};
    if (trimmedName !== (farm.name ?? '')) payload.name = trimmedName;
    const trimOwner = fields.owner.trim();
    if (trimOwner !== (farm.owner ?? '')) payload.owner = trimOwner;
    const trimLocation = fields.location.trim();
    if (trimLocation !== (farm.location ?? '')) payload.location = trimLocation;
    const trimCrop = fields.crop_type.trim();
    if (trimCrop !== (farm.crop_type ?? '')) payload.crop_type = trimCrop;
    const areaNum = fields.area_ha.trim() !== '' ? Number(fields.area_ha) : null;
    if (areaNum !== farm.area_ha && areaNum != null && Number.isFinite(areaNum)) {
      payload.area_ha = areaNum;
    }

    mutate(payload as Parameters<typeof mutate>[0], {
      onSuccess: () => onClose(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">{t('farms.editForm.nameLabel')}</Label>
            <Input
              id="edit-name"
              value={fields.name}
              onChange={set('name')}
              placeholder={t('farms.editForm.namePlaceholder')}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-owner">{t('farms.editForm.ownerLabel')}</Label>
            <Input
              id="edit-owner"
              value={fields.owner}
              onChange={set('owner')}
              placeholder={t('farms.editForm.ownerPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-location">{t('farms.editForm.locationLabel')}</Label>
            <Input
              id="edit-location"
              value={fields.location}
              onChange={set('location')}
              placeholder={t('farms.editForm.locationPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-crop">{t('farms.editForm.cropLabel')}</Label>
            <Input
              id="edit-crop"
              value={fields.crop_type}
              onChange={set('crop_type')}
              placeholder={t('farms.editForm.cropPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-area">{t('farms.editForm.areaLabel')}</Label>
            <Input
              id="edit-area"
              type="number"
              min="0"
              step="0.01"
              value={fields.area_ha}
              onChange={set('area_ha')}
              placeholder={t('farms.editForm.areaPlaceholder')}
            />
          </div>
          <SheetFooter className="flex-row justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              {t('farms.editForm.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('farms.editForm.submitting') : t('farms.editForm.submit')}
            </Button>
          </SheetFooter>
        </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const toneTextClass: Record<string, string> = {
  green: 'text-emerald-500 dark:text-emerald-400',
  yellow: 'text-amber-500 dark:text-amber-400',
  red: 'text-red-500 dark:text-red-400',
  neutral: 'text-muted-foreground',
};

function ValveStatCard({ summary }: { summary: FarmSummary }) {
  const { t } = useTranslation();
  const activeNode = summary.nodes.find((ns) => ns.node.status !== 'offline' && ns.decision);
  const valveKey = activeNode ? valveKeyFromDecision(activeNode.decision) : null;
  const valveBadge = getValveStatusBadge(valveKey ?? 'valve.unknown');
  const textClass = toneTextClass[valveBadge.tone] ?? toneTextClass.neutral;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Status Valve
      </span>
      <div className="mt-4 flex items-center gap-5">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted">
          <Droplet className={cn('size-9', textClass)} />
        </div>
        <div className="flex flex-col gap-2">
          <span className={cn('text-3xl font-bold uppercase tracking-wide', textClass)}>
            {t(valveBadge.labelKey)}
          </span>
          <span className="flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground w-fit">
            <Zap className="size-3" /> Mode Otomatis
          </span>
        </div>
      </div>
    </div>
  );
}

const weatherIcon: Record<WeatherIconKey, typeof Sun> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  'cloud-showers': CloudRainWind,
  'cloud-bolt': CloudLightning,
  unknown: CloudOff,
};

function PillRow({ label, pill }: { label: string; pill: Pill }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <StatusPill tone={pill.tone} label={pill.label} />
    </div>
  );
}

function IrrigasiCard({ summary }: { summary: FarmSummary }) {
  const { t } = useTranslation();
  const avg = summary.average_soil_moisture;
  const { lower, upper } = summary.thresholds;
  const activeNode = summary.nodes.find((ns) => ns.node.status !== 'offline' && ns.decision);
  const isMock = summary.is_mock_data === true;

  const soil: Pill =
    avg > 0 ? { label: t(getSoilStatusFromMoisture(avg, lower, upper).labelKey), tone: getSoilStatusFromMoisture(avg, lower, upper).tone } : { label: t('farmDetail.noData'), tone: 'neutral' };
  const irrig: Pill = activeNode
    ? { label: t(getIrrigationStatusBadge(activeNode.decision.decision).labelKey), tone: getIrrigationStatusBadge(activeNode.decision.decision).tone }
    : { label: t('farmDetail.waitingGateway'), tone: 'neutral' };
  const valveKey = activeNode ? valveKeyFromDecision(activeNode.decision) : null;
  const valve: Pill = valveKey
    ? { label: t(getValveStatusBadge(valveKey).labelKey), tone: getValveStatusBadge(valveKey).tone }
    : { label: t('farmDetail.unknown'), tone: 'neutral' };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Droplet className="size-4 text-muted-foreground" /> {t('farmDetail.irrigationTitle')}
          {isMock && <StatusPill tone="yellow" label="Data Contoh" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <PillRow label={t('farmDetail.soilStatus')} pill={soil} />
        <PillRow label={t('farmDetail.irrigationStatus')} pill={irrig} />
        <PillRow label={t('farmDetail.valveStatus')} pill={valve} />
      </CardContent>
    </Card>
  );
}

function GatewayCard({ summary }: { summary: FarmSummary }) {
  const { t } = useTranslation();
  const gw = getGatewayStatusBadge(summary.gateway_status);
  const GwIcon = summary.gateway_status === 'offline' ? WifiOff : RadioTower;
  const isMock = summary.is_mock_data === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RadioTower className="size-4 text-muted-foreground" /> Gateway
          {isMock && <StatusPill tone="yellow" label="Data Contoh" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-2 py-2">
          <GwIcon className="size-10 text-muted-foreground" />
          <StatusPill tone={gw.tone} label={t(gw.labelKey)} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('farmDetail.lastOnline')}</span>
          <span className="font-medium text-foreground">{timeAgo(summary.farm.updated_at, t)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function WeatherCard({ summary }: { summary: FarmSummary }) {
  const { t } = useTranslation();
  const weather = summary.weather;
  const condition = weather?.condition || t('farmDetail.weatherUnavailable');
  const WeatherIcon = weatherIcon[getWeatherInfo(condition).iconKey];
  const temp =
    weather && Number.isFinite(Number(weather.temperature)) ? `${weather.temperature}${DEG_C}` : '—';
  const rain: Pill = !weather
    ? { label: t('farmDetail.weatherUnavailable'), tone: 'neutral' }
    : weather.rain_next_3h
      ? { label: t('farmDetail.rainPredicted'), tone: 'yellow' }
      : { label: t('farmDetail.noRain'), tone: 'green' };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CloudSun className="size-4 text-muted-foreground" /> {t('farmDetail.weatherTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 py-2">
          <WeatherIcon className="size-10 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
              {temp}
            </span>
            <span className="text-sm text-muted-foreground">
              {weather ? t(getWeatherInfo(condition).label) : t('farmDetail.weatherUnavailable')}
            </span>
          </div>
        </div>
        <PillRow label={t('farmDetail.rainForecast')} pill={rain} />
      </CardContent>
    </Card>
  );
}

function NodeTableRow({ ns }: { ns: NodeSummary }) {
  const { t } = useTranslation();
  const node = ns.node;
  const reading = ns.latest_reading;
  const offline = node.status === 'offline';
  const valveKey = valveKeyFromDecision(ns.decision);
  const valveBadge = getValveStatusBadge(valveKey);
  const valve: Pill = { label: t(valveBadge.labelKey), tone: valveBadge.tone };
  const statusBadge = getNodeStatusBadge(node.status);
  const status: Pill = { label: t(statusBadge.labelKey), tone: statusBadge.tone };

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{node.name || node.id}</span>
          <span className="text-xs text-muted-foreground">{node.location || ''}</span>
        </div>
      </TableCell>
      <TableCell className="tabular-nums">
        {offline || !reading ? '—' : `${reading.soil_moisture}%`}
      </TableCell>
      <TableCell className="tabular-nums">
        {offline || !reading ? '—' : `${reading.soil_temp}${DEG_C}`}
      </TableCell>
      <TableCell>
        <StatusPill tone={valve.tone} label={valve.label} />
      </TableCell>
      <TableCell className="tabular-nums">{offline ? '—' : `${node.battery ?? 0}%`}</TableCell>
      <TableCell>
        <StatusPill tone={status.tone} label={status.label} />
      </TableCell>
      <TableCell className="text-muted-foreground">{timeAgo(node.updated_at, t)}</TableCell>
    </TableRow>
  );
}

export default function FarmDetailPage() {
  const { id: farmId } = useParams();
  const { t } = useTranslation();
  const { data: summary, isLoading, error } = useFarmSummary(farmId ?? '');
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="space-y-3">
        <p className="text-destructive">
          {error ? t('farmDetail.errorLoad', { message: error.message }) : t('farmDetail.noData2')}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">{t('farmDetail.backToList')}</Link>
        </Button>
      </div>
    );
  }

  const nodes = summary.nodes;
  const { lower, upper } = summary.thresholds;
  const avg = summary.average_soil_moisture;
  const weather = summary.weather;
  const activeCount = nodes.filter((ns) => ns.node.status !== 'offline').length;
  const warning = summary.nodes_problem > 0 ? t('farmDetail.nodesProblem', { count: summary.nodes_problem }) : null;
  const isMock = summary.is_mock_data === true;

  const kelembapanText = avg > 0 ? `${avg}%` : '—';
  const suhuText =
    weather && Number.isFinite(Number(weather.temperature)) ? `${weather.temperature}${DEG_C}` : '—';
  const humidityText =
    weather && Number.isFinite(Number(weather.humidity)) ? `${weather.humidity}%` : '—';

  return (
    <div className="space-y-4">
      {summary && (
        <EditFarmSheet
          farmId={farmId ?? ''}
          farm={summary.farm}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {warning && (
        <Card className="border-amber-500/50">
          <CardContent className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <TriangleAlert className="size-4" /> {warning}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <ValveStatCard summary={summary} />
        <StatCard
          label={t('farmDetail.avgMoisture')}
          value={kelembapanText}
          sublabel={`Threshold ${lower}–${upper}%`}
          icon={<Droplet className="size-4" />}
        />
        <StatCard
          label={t('farmDetail.activeNodes')}
          value={`${activeCount}/${nodes.length}`}
          icon={<Cpu className="size-4" />}
        />
        <StatCard label={t('farmDetail.airTemp')} value={suhuText} icon={<Thermometer className="size-4" />} />
        <StatCard
          label={t('farmDetail.airHumidity')}
          value={humidityText}
          icon={<Droplets className="size-4" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <IrrigasiCard summary={summary} />
        <GatewayCard summary={summary} />
        <WeatherCard summary={summary} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="size-4 text-muted-foreground" /> {t('farmDetail.nodeTableTitle')}
            {isMock && <StatusPill tone="yellow" label="Data Contoh" />}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> {t('farms.editForm.trigger')}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/farms/${encodeURIComponent(farmId ?? '')}/monitoring`}>
                <LineChart className="size-4" /> {t('farmDetail.viewMonitoring')}
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {nodes.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-8 text-center">
              <Cpu className="size-8 text-muted-foreground" />
              <p className="font-medium text-foreground">{t('farmDetail.noNodes')}</p>
              <p className="text-sm text-muted-foreground">{t('farmDetail.noNodesDesc')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('farmDetail.colNode')}</TableHead>
                  <TableHead>{t('farmDetail.colMoisture')}</TableHead>
                  <TableHead>{t('farmDetail.colSoilTemp')}</TableHead>
                  <TableHead>{t('farmDetail.colValve')}</TableHead>
                  <TableHead>{t('farmDetail.colBattery')}</TableHead>
                  <TableHead>{t('farmDetail.colStatus')}</TableHead>
                  <TableHead>{t('farmDetail.colUpdate')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nodes.map((ns) => (
                  <NodeTableRow key={ns.node.id} ns={ns} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
