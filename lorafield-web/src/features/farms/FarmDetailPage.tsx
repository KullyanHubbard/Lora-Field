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
  Leaf,
  LineChart,
  MapPin,
  RadioTower,
  Ruler,
  Sun,
  TriangleAlert,
  WifiOff,
} from 'lucide-react';
import { useFarmSummary } from './queries';
import { getFarmLastUpdate, valveLabelFromDecision } from './farmHelpers';
import {
  getGatewayStatusBadge,
  getIrrigationStatusBadge,
  getNodeStatusBadge,
  getSoilGaugeState,
  getSoilStatusFromMoisture,
  getValveStatusBadge,
  type SoilGaugeState,
  type StatusTone,
} from '@/lib/status';
import { DEG_C, formatAreaHa, timeAgo } from '@/lib/format';
import { getWeatherInfo, type WeatherIconKey } from '@/features/weather/weatherHelpers';
import { cn } from '@/lib/utils';
import { StatusBadge, STATUS_TONE_CLASS } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
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

const weatherIcon: Record<WeatherIconKey, typeof Sun> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  'cloud-showers': CloudRainWind,
  'cloud-bolt': CloudLightning,
  unknown: CloudOff,
};

// Singkat alamat panjang → "Sleman, DIY" (port dari FarmDetailPage.jsx lama).
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

const gaugeColor: Record<SoilGaugeState, string> = {
  'no-data': 'text-muted-foreground',
  dry: 'text-red-500',
  wet: 'text-blue-500',
  normal: 'text-emerald-500',
};

function SoilGauge({
  value,
  lower,
  upper,
}: {
  value: number | null | undefined;
  lower: number;
  upper: number;
}) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const numeric = typeof value === 'number' ? value : 0;
  const hasData = value != null && value > 0;
  const pct = hasData ? Math.min(Math.max(numeric, 0), 100) / 100 : 0;
  const offset = circ * (1 - pct);
  const state = getSoilGaugeState(value, lower, upper);

  return (
    <div className="flex justify-center py-2">
      <svg viewBox="0 0 100 100" className="size-36" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          className="text-muted"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={hasData ? offset : circ * 0.88}
          transform="rotate(-90 50 50)"
          className={cn('transition-all duration-700 ease-out', gaugeColor[state])}
        />
        <text
          x="50"
          y="47"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="currentColor"
          fontSize="17"
          fontWeight="700"
          className={cn('font-mono', hasData ? gaugeColor[state] : 'text-muted-foreground')}
        >
          {hasData ? `${numeric}%` : '—'}
        </text>
        {!hasData && (
          <text
            x="50"
            y="63"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="currentColor"
            fontSize="7.5"
            fontWeight="600"
            className="text-muted-foreground"
          >
            No Data
          </text>
        )}
      </svg>
    </div>
  );
}

function MetricRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function FarmInfoBar({ summary }: { summary: FarmSummary }) {
  const { farm } = summary;
  const lastUpd = getFarmLastUpdate(farm, summary.nodes);
  const gwBadge = getGatewayStatusBadge(summary.gateway_status);
  const farmBadge: { label: string; tone: StatusTone } =
    farm.status === 'warning'
      ? { label: 'Perlu Perhatian', tone: 'yellow' }
      : { label: 'Normal', tone: 'green' };

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">{farm.name}</h2>
          <div className="flex items-center gap-2">
            <StatusBadge {...farmBadge} />
            <Badge className={cn('gap-1', STATUS_TONE_CLASS[gwBadge.tone])}>
              <RadioTower className="size-3" /> {gwBadge.label}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Leaf className="size-4" /> {farm.crop_type || '—'}
          </span>
          <span className="flex items-center gap-1.5">
            <Ruler className="size-4" /> {formatAreaHa(farm.area_ha)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-4" /> {shortLocation(farm.location)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" /> {timeAgo(lastUpd)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SoilCard({ summary }: { summary: FarmSummary }) {
  const avg = summary.average_soil_moisture;
  const { lower, upper } = summary.thresholds;
  const soilBadge = getSoilStatusFromMoisture(avg, lower, upper);

  const activeNode = summary.nodes.find((ns) => ns.node.status !== 'offline' && ns.decision);
  const irrigBadge: { label: string; tone: StatusTone } = activeNode
    ? getIrrigationStatusBadge(activeNode.decision.decision)
    : { label: 'Perlu cek gateway', tone: 'red' };
  const valveBadge = getValveStatusBadge(
    activeNode ? valveLabelFromDecision(activeNode.decision) : 'Tidak diketahui',
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Droplet className="size-4 text-primary" /> Kelembapan & Irigasi
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SoilGauge value={avg} lower={lower} upper={upper} />
        <div className="space-y-2">
          <MetricRow label="Status Tanah">
            <StatusBadge {...soilBadge} />
          </MetricRow>
          <MetricRow label="Status Irigasi">
            <StatusBadge {...irrigBadge} />
          </MetricRow>
          <MetricRow label="Status Valve">
            <StatusBadge {...valveBadge} />
          </MetricRow>
        </div>
      </CardContent>
    </Card>
  );
}

function GatewayCard({ summary }: { summary: FarmSummary }) {
  const gwBadge = getGatewayStatusBadge(summary.gateway_status);
  const isOffline = summary.gateway_status === 'offline';
  const GwIcon = isOffline ? WifiOff : RadioTower;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RadioTower className="size-4 text-primary" /> Gateway
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-2 py-2">
          <GwIcon className="size-10 text-muted-foreground" />
          <StatusBadge label={gwBadge.label} tone={gwBadge.tone} />
        </div>
        <MetricRow label="Terakhir Online">
          <strong className="text-foreground">{timeAgo(summary.farm.updated_at)}</strong>
        </MetricRow>
      </CardContent>
    </Card>
  );
}

function WeatherCard({ summary }: { summary: FarmSummary }) {
  const weather = summary.weather;
  const condition = weather?.condition || 'Belum tersedia';
  const info = getWeatherInfo(condition);
  const WeatherIcon = weatherIcon[info.iconKey];
  const tempRaw = weather?.temperature;
  const temp = tempRaw != null && Number.isFinite(Number(tempRaw)) ? `${tempRaw}${DEG_C}` : '—';
  const rainBadge: { label: string; tone: StatusTone } = !weather
    ? { label: 'Cuaca Belum Tersedia', tone: 'red' }
    : weather.rain_next_3h
      ? { label: 'Prediksi Hujan', tone: 'yellow' }
      : { label: 'Tidak Ada Hujan', tone: 'green' };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CloudSun className="size-4 text-primary" /> Cuaca
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 py-2">
          <WeatherIcon className="size-10 text-primary" />
          <div className="flex flex-col">
            <span className="text-2xl font-semibold text-foreground">{temp}</span>
            <span className="text-sm text-muted-foreground">
              {weather ? condition : 'Belum tersedia'}
            </span>
          </div>
        </div>
        <MetricRow label="Prediksi Hujan (3 jam)">
          <StatusBadge {...rainBadge} />
        </MetricRow>
      </CardContent>
    </Card>
  );
}

function NodeTableRow({ ns }: { ns: NodeSummary }) {
  const node = ns.node;
  const reading = ns.latest_reading;
  const offline = node.status === 'offline';
  const valveBadge = getValveStatusBadge(valveLabelFromDecision(ns.decision));
  const statusBadge = getNodeStatusBadge(node.status);

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{node.name || node.id}</span>
          <span className="text-xs text-muted-foreground">{node.location || ''}</span>
        </div>
      </TableCell>
      <TableCell className="font-mono">
        {offline || !reading ? '—' : `${reading.soil_moisture}%`}
      </TableCell>
      <TableCell className="font-mono">
        {offline || !reading ? '—' : `${reading.soil_temp}${DEG_C}`}
      </TableCell>
      <TableCell>
        <StatusBadge {...valveBadge} />
      </TableCell>
      <TableCell className="font-mono">{offline ? '—' : `${node.battery ?? 0}%`}</TableCell>
      <TableCell>
        <StatusBadge {...statusBadge} />
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
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
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
  const warning = summary.nodes_problem > 0 ? `${summary.nodes_problem} node bermasalah` : null;

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

      <div className="grid gap-4 md:grid-cols-3">
        <SoilCard summary={summary} />
        <GatewayCard summary={summary} />
        <WeatherCard summary={summary} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="size-4 text-primary" /> Status Node Sensor
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
