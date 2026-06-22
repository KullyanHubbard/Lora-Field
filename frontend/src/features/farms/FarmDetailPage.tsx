import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Cloud,
  CloudLightning,
  CloudOff,
  CloudRain,
  CloudRainWind,
  CloudSun,
  Cpu,
  Droplet,
  Droplets,
  Leaf,
  LineChart,
  MapPin,
  RadioTower,
  Ruler,
  Sun,
  Thermometer,
  TriangleAlert,
  WifiOff,
} from 'lucide-react';
import { useFarmSummary } from './queries';
import { getFarmLastUpdate, valveKeyFromDecision } from './farmHelpers';
import {
  getGatewayStatusBadge,
  getIrrigationStatusBadge,
  getNodeStatusBadge,
  getSoilStatusFromMoisture,
  getValveStatusBadge,
} from '@/lib/status';
import { DEG_C, formatAreaHa, timeAgo } from '@/lib/format';
import { getWeatherInfo, type WeatherIconKey } from '@/features/weather/weatherHelpers';
import { StatCard } from '@/components/ui/stat-card';
import { StatusPill, type PillTone } from '@/components/ui/status-pill';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const weatherIcon: Record<WeatherIconKey, typeof Sun> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  'cloud-showers': CloudRainWind,
  'cloud-bolt': CloudLightning,
  unknown: CloudOff,
};

// Singkat alamat panjang → "Sleman, DIY".
function shortLocation(loc: string | null | undefined): string {
  if (!loc) return '—';
  const kabMatch = loc.match(/Kabupaten\s+(\w+)/i);
  const kotaMatch = loc.match(/Kota\s+(\w+)/i);
  const city = kabMatch?.[1] || kotaMatch?.[1];
  let province: string | null = null;
  if (/yogyakarta/i.test(loc)) province = 'DIY';
  else if (/jawa\s+tengah/i.test(loc)) province = 'Jateng';
  else if (/jawa\s+timur/i.test(loc)) province = 'Jatim';
  else if (/jawa\s+barat/i.test(loc)) province = 'Jabar';
  if (city && province) return `${city}, ${province}`;
  if (city) return city;
  return loc.length > 28 ? loc.slice(0, 26) + '…' : loc;
}

function PillRow({ label, pill }: { label: string; pill: Pill }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <StatusPill tone={pill.tone} label={pill.label} />
    </div>
  );
}

function MetaItem({ icon, value }: { icon: typeof Leaf; value: string }) {
  const Icon = icon;
  return (
    <span className="flex items-center gap-1.5">
      <Icon className="size-4" /> {value}
    </span>
  );
}

function FarmInfoBar({ summary }: { summary: FarmSummary }) {
  const { t } = useTranslation();
  const { farm } = summary;
  const lastUpd = getFarmLastUpdate(farm, summary.nodes);
  const gw = getGatewayStatusBadge(summary.gateway_status);
  const farmPill: Pill =
    farm.status === 'warning'
      ? { label: t('farmDetail.statusWarning'), tone: 'yellow' }
      : { label: t('farmDetail.statusNormal'), tone: 'green' };

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">{farm.name}</h2>
          <div className="flex items-center gap-2">
            <StatusPill tone={farmPill.tone} label={farmPill.label} />
            <StatusPill tone={gw.tone} label={`Gateway ${t(gw.labelKey)}`} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <MetaItem icon={Leaf} value={farm.crop_type || '—'} />
          <MetaItem icon={Ruler} value={formatAreaHa(farm.area_ha)} />
          <MetaItem icon={MapPin} value={shortLocation(farm.location)} />
          <MetaItem icon={Clock} value={timeAgo(lastUpd, t)} />
        </div>
      </CardContent>
    </Card>
  );
}

function IrrigasiCard({ summary }: { summary: FarmSummary }) {
  const { t } = useTranslation();
  const avg = summary.average_soil_moisture;
  const { lower, upper } = summary.thresholds;
  const activeNode = summary.nodes.find((ns) => ns.node.status !== 'offline' && ns.decision);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RadioTower className="size-4 text-muted-foreground" /> Gateway
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

  const kelembapanText = avg > 0 ? `${avg}%` : '—';
  const suhuText =
    weather && Number.isFinite(Number(weather.temperature)) ? `${weather.temperature}${DEG_C}` : '—';
  const humidityText =
    weather && Number.isFinite(Number(weather.humidity)) ? `${weather.humidity}%` : '—';

  return (
    <div className="space-y-4">
      <FarmInfoBar summary={summary} />

      {warning && (
        <Card className="border-amber-500/50">
          <CardContent className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <TriangleAlert className="size-4" /> {warning}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
          </CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to={`/farms/${encodeURIComponent(farmId ?? '')}/monitoring`}>
              <LineChart className="size-4" /> {t('farmDetail.viewMonitoring')}
            </Link>
          </Button>
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
