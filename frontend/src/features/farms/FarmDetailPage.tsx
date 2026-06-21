import { Link, useParams } from 'react-router-dom';
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
import { getFarmLastUpdate, valveLabelFromDecision } from './farmHelpers';
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
  const { farm } = summary;
  const lastUpd = getFarmLastUpdate(farm, summary.nodes);
  const gw = getGatewayStatusBadge(summary.gateway_status);
  const farmPill: Pill =
    farm.status === 'warning'
      ? { label: 'Perlu Perhatian', tone: 'yellow' }
      : { label: 'Normal', tone: 'green' };

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">{farm.name}</h2>
          <div className="flex items-center gap-2">
            <StatusPill tone={farmPill.tone} label={farmPill.label} />
            <StatusPill tone={gw.tone} label={`Gateway ${gw.label}`} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <MetaItem icon={Leaf} value={farm.crop_type || '—'} />
          <MetaItem icon={Ruler} value={formatAreaHa(farm.area_ha)} />
          <MetaItem icon={MapPin} value={shortLocation(farm.location)} />
          <MetaItem icon={Clock} value={timeAgo(lastUpd)} />
        </div>
      </CardContent>
    </Card>
  );
}

function IrrigasiCard({ summary }: { summary: FarmSummary }) {
  const avg = summary.average_soil_moisture;
  const { lower, upper } = summary.thresholds;
  const activeNode = summary.nodes.find((ns) => ns.node.status !== 'offline' && ns.decision);

  // No-data → neutral (abu-abu), bukan merah (DESIGN.md).
  const soil: Pill =
    avg > 0 ? getSoilStatusFromMoisture(avg, lower, upper) : { label: 'Tidak Ada Data', tone: 'neutral' };
  const irrig: Pill = activeNode
    ? getIrrigationStatusBadge(activeNode.decision.decision)
    : { label: 'Menunggu Gateway', tone: 'neutral' };
  const valve: Pill = activeNode
    ? getValveStatusBadge(valveLabelFromDecision(activeNode.decision))
    : { label: 'Tidak Diketahui', tone: 'neutral' };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Droplet className="size-4 text-muted-foreground" /> Irigasi
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <PillRow label="Status Tanah" pill={soil} />
        <PillRow label="Status Irigasi" pill={irrig} />
        <PillRow label="Status Valve" pill={valve} />
      </CardContent>
    </Card>
  );
}

function GatewayCard({ summary }: { summary: FarmSummary }) {
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
          <StatusPill tone={gw.tone} label={gw.label} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Terakhir Online</span>
          <span className="font-medium text-foreground">{timeAgo(summary.farm.updated_at)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function WeatherCard({ summary }: { summary: FarmSummary }) {
  const weather = summary.weather;
  const condition = weather?.condition || 'Belum tersedia';
  const WeatherIcon = weatherIcon[getWeatherInfo(condition).iconKey];
  const temp =
    weather && Number.isFinite(Number(weather.temperature)) ? `${weather.temperature}${DEG_C}` : '—';
  const rain: Pill = !weather
    ? { label: 'Belum Tersedia', tone: 'neutral' }
    : weather.rain_next_3h
      ? { label: 'Prediksi Hujan', tone: 'yellow' }
      : { label: 'Tidak Ada Hujan', tone: 'green' };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CloudSun className="size-4 text-muted-foreground" /> Cuaca
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
              {weather ? condition : 'Belum tersedia'}
            </span>
          </div>
        </div>
        <PillRow label="Prediksi Hujan (3 jam)" pill={rain} />
      </CardContent>
    </Card>
  );
}

function NodeTableRow({ ns }: { ns: NodeSummary }) {
  const node = ns.node;
  const reading = ns.latest_reading;
  const offline = node.status === 'offline';
  const valveLabel = valveLabelFromDecision(ns.decision);
  const valve: Pill =
    valveLabel === 'Tidak diketahui'
      ? { label: 'Tidak diketahui', tone: 'neutral' }
      : { label: valveLabel, tone: getValveStatusBadge(valveLabel).tone };
  const status = getNodeStatusBadge(node.status);

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
      <TableCell className="text-muted-foreground">{timeAgo(node.updated_at)}</TableCell>
    </TableRow>
  );
}

export default function FarmDetailPage() {
  const { id: farmId } = useParams();
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
          {error ? `Gagal memuat ringkasan kebun: ${error.message}` : 'Data tidak tersedia.'}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">Kembali ke Daftar Kebun</Link>
        </Button>
      </div>
    );
  }

  const nodes = summary.nodes;
  const { lower, upper } = summary.thresholds;
  const avg = summary.average_soil_moisture;
  const weather = summary.weather;
  const activeCount = nodes.filter((ns) => ns.node.status !== 'offline').length;
  const warning = summary.nodes_problem > 0 ? `${summary.nodes_problem} node bermasalah` : null;

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
          label="Kelembapan Rata-rata"
          value={kelembapanText}
          sublabel={`Threshold ${lower}–${upper}%`}
          icon={<Droplet className="size-4" />}
        />
        <StatCard
          label="Node Aktif"
          value={`${activeCount}/${nodes.length}`}
          icon={<Cpu className="size-4" />}
        />
        <StatCard label="Suhu Udara" value={suhuText} icon={<Thermometer className="size-4" />} />
        <StatCard
          label="Kelembapan Udara"
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
            <Cpu className="size-4 text-muted-foreground" /> Status Node Sensor
          </CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to={`/farms/${encodeURIComponent(farmId ?? '')}/monitoring`}>
              <LineChart className="size-4" /> Lihat Monitoring
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {nodes.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-8 text-center">
              <Cpu className="size-8 text-muted-foreground" />
              <p className="font-medium text-foreground">Belum ada sensor terhubung</p>
              <p className="text-sm text-muted-foreground">
                Kebun ini belum memiliki node sensor yang terdaftar
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Node</TableHead>
                  <TableHead>Kelembapan</TableHead>
                  <TableHead>Suhu Tanah</TableHead>
                  <TableHead>Valve</TableHead>
                  <TableHead>Baterai</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Update</TableHead>
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
