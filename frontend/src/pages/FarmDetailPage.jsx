import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../layout/DashboardLayout';
import { getFarmSummary } from '../services/api';
import { setSelectedFarmId } from '../services/farms';
import {
  DEG_C,
  formatAreaHa,
  getFarmLastUpdate,
  getGatewayStatusBadge,
  getIrrigationStatusBadge,
  getNodeStatusBadge,
  getSoilStatusFromMoisture,
  getValveStatusBadge,
  getWeatherInfo,
  timeAgo,
  valveLabelFromDecision,
} from '../utils/farmHelpers';

function StatusBadge({ label, className }) {
  return <span className={`badge ${className}`}>{label}</span>;
}

// Singkat alamat panjang → "Sleman, DIY"
function shortLocation(loc) {
  if (!loc) return '—';
  const kabMatch = loc.match(/Kabupaten\s+(\w+)/i);
  const kotaMatch = loc.match(/Kota\s+(\w+)/i);
  const city = kabMatch?.[1] || kotaMatch?.[1];
  let province = null;
  if (/yogyakarta/i.test(loc)) province = 'DIY';
  else if (/jawa\s+tengah/i.test(loc)) province = 'Jateng';
  else if (/jawa\s+timur/i.test(loc)) province = 'Jatim';
  else if (/jawa\s+barat/i.test(loc)) province = 'Jabar';
  if (city && province) return `${city}, ${province}`;
  if (city) return city;
  return loc.length > 28 ? loc.slice(0, 26) + '…' : loc;
}

// ── Header ─────────────────────────────────────────────────────────────────

function FarmInfoBar({ farm, summary }) {
  const lastUpd = getFarmLastUpdate(farm, summary.nodes || []);
  const gwBadge = getGatewayStatusBadge(summary.gateway_status);
  const farmBadge =
    farm.status === 'warning'
      ? { className: 'badge-yellow', label: 'Perlu Perhatian' }
      : { className: 'badge-green', label: 'Normal' };

  return (
    <div className="card fd-info-card mb-24">
      <div className="fd-info-top">
        <h2 className="farm-title">{farm.name}</h2>
        <div className="farm-badges">
          <StatusBadge {...farmBadge} />
          <span className={`badge ${gwBadge.className}`}>
            <i className="fas fa-tower-broadcast" aria-hidden="true" /> {gwBadge.label}
          </span>
        </div>
      </div>
      <div className="fd-meta-row">
        <span className="fd-meta-item">
          <i className="fas fa-leaf" aria-hidden="true" />
          {farm.crop_type || '—'}
        </span>
        <span className="fd-meta-item">
          <i className="fas fa-ruler-combined" aria-hidden="true" />
          {formatAreaHa(farm.area_ha)}
        </span>
        <span className="fd-meta-item">
          <i className="fas fa-location-dot" aria-hidden="true" />
          {shortLocation(farm.location)}
        </span>
        <span className="fd-meta-item">
          <i className="fas fa-clock" aria-hidden="true" />
          {timeAgo(lastUpd)}
        </span>
      </div>
    </div>
  );
}

function WarningCard({ message }) {
  if (!message) return null;
  return (
    <div className="card farm-warning-card mb-24">
      <div className="farm-warning-text">
        <i className="fas fa-triangle-exclamation farm-warning-icon" aria-hidden="true" />
        {message}
      </div>
    </div>
  );
}

// ── Gauge SVG ──────────────────────────────────────────────────────────────

function SoilGauge({ value, lower = 40, upper = 70 }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const hasData = value != null && value > 0;
  const pct = hasData ? Math.min(Math.max(value, 0), 100) / 100 : 0;
  const offset = circ * (1 - pct);

  let arcColor = 'rgba(255,255,255,0.12)';
  if (hasData) {
    if (value < lower) arcColor = '#ef4444';
    else if (value > upper) arcColor = '#3b82f6';
    else arcColor = '#10b981';
  }

  return (
    <div className="fd-gauge-wrap">
      <svg viewBox="0 0 100 100" className="fd-gauge-svg" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
        <circle
          cx="50" cy="50" r={r}
          fill="none"
          stroke={arcColor}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={hasData ? offset : circ * 0.88}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x="50" y="47"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={hasData ? arcColor : '#475569'}
          fontSize="17"
          fontWeight="700"
          fontFamily="monospace"
        >
          {hasData ? `${value}%` : '—'}
        </text>
        {!hasData && (
          <text
            x="50" y="63"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#334155"
            fontSize="7.5"
            fontWeight="600"
          >
            No Data
          </text>
        )}
      </svg>
    </div>
  );
}

// ── Card 1: Soil & Irigasi ─────────────────────────────────────────────────

function SoilCard({ summary, thresholds }) {
  const avg = summary.average_soil_moisture;
  const lower = thresholds?.lower ?? 40;
  const upper = thresholds?.upper ?? 70;
  const soilBadge = getSoilStatusFromMoisture(avg, lower, upper);

  const activeNodeSummary = (summary.nodes || []).find(
    (ns) => ns.node && ns.node.status !== 'offline' && ns.decision,
  );
  const irrigBadge = activeNodeSummary
    ? getIrrigationStatusBadge(activeNodeSummary.decision.decision)
    : { label: 'Perlu cek gateway', className: 'badge-red' };
  const valveBadge = getValveStatusBadge(
    activeNodeSummary ? valveLabelFromDecision(activeNodeSummary.decision) : 'Tidak diketahui',
  );

  return (
    <div className="fd-metric-card">
      <div className="fd-metric-header">
        <i className="fas fa-droplet" aria-hidden="true" />
        <span>Kelembapan &amp; Irigasi</span>
      </div>
      <SoilGauge value={avg} lower={lower} upper={upper} />
      <div className="fd-metric-rows">
        <div className="fd-metric-row">
          <span>Status Tanah</span>
          <StatusBadge {...soilBadge} />
        </div>
        <div className="fd-metric-row">
          <span>Status Irigasi</span>
          <StatusBadge {...irrigBadge} />
        </div>
        <div className="fd-metric-row">
          <span>Status Valve</span>
          <StatusBadge {...valveBadge} />
        </div>
      </div>
    </div>
  );
}

// ── Card 2: Gateway ────────────────────────────────────────────────────────

function GatewayCard({ summary, farm }) {
  const gwBadge = getGatewayStatusBadge(summary.gateway_status);
  const isOffline = summary.gateway_status !== 'online';
  const isDegraded = summary.gateway_status === 'degraded';

  return (
    <div className={`fd-metric-card${isOffline && !isDegraded ? ' fd-gw-offline' : isDegraded ? ' fd-gw-degraded' : ''}`}>
      <div className="fd-metric-header">
        <i className="fas fa-tower-broadcast" aria-hidden="true" />
        <span>Gateway</span>
      </div>
      <div className="fd-gw-status-block">
        <div className={`fd-gw-icon ${isOffline ? 'fd-gw-icon--offline' : isDegraded ? 'fd-gw-icon--degraded' : 'fd-gw-icon--online'}`}>
          <i className={`fas ${isOffline && !isDegraded ? 'fa-wifi-slash' : 'fa-tower-broadcast'}`} aria-hidden="true" />
        </div>
        <span className={`fd-gw-status-label badge ${gwBadge.className}`}>{gwBadge.label}</span>
      </div>
      <div className="fd-metric-rows">
        <div className="fd-metric-row">
          <span>Terakhir Online</span>
          <strong>{timeAgo(farm.updated_at)}</strong>
        </div>
      </div>
    </div>
  );
}

// ── Card 3: Weather ────────────────────────────────────────────────────────

function WeatherCard({ summary }) {
  const weather = summary.weather;
  const condition = weather?.condition || 'Belum tersedia';
  const weatherInfo = getWeatherInfo(condition);
  const tempRaw = weather?.temperature;
  const temp =
    tempRaw != null && Number.isFinite(Number(tempRaw)) ? `${tempRaw}${DEG_C}` : '—';
  const isRain = weatherInfo.isRain;
  const rainBadge = !weather
    ? { label: 'Cuaca Belum Tersedia', className: 'badge-red' }
    : weather.rain_next_3h
      ? { label: 'Prediksi Hujan', className: 'badge-yellow' }
      : { label: 'Tidak Ada Hujan', className: 'badge-green' };

  return (
    <div className={`fd-metric-card ${isRain ? 'fd-weather-rain' : 'fd-weather-clear'}`}>
      <div className="fd-metric-header">
        <i className="fas fa-cloud-sun" aria-hidden="true" />
        <span>Cuaca</span>
      </div>
      <div className="fd-weather-main">
        <div className={`fd-weather-icon ${isRain ? 'fd-weather-icon--rain' : 'fd-weather-icon--clear'}`}>
          <i className={weatherInfo.icon} aria-hidden="true" />
        </div>
        <div className="fd-weather-temp-block">
          <span className="fd-weather-temp">{temp}</span>
          <span className="fd-weather-cond">{weather ? condition : 'Belum tersedia'}</span>
        </div>
      </div>
      <div className="fd-metric-rows">
        <div className="fd-metric-row">
          <span>Prediksi Hujan (3 jam)</span>
          <StatusBadge {...rainBadge} />
        </div>
      </div>
    </div>
  );
}

// ── Node Table ─────────────────────────────────────────────────────────────

function NodeRows({ nodes }) {
  return (
    <tbody>
      {nodes.map((ns) => {
        const node = ns.node || {};
        const reading = ns.latest_reading;
        const offline = node.status === 'offline';
        const valveLabel = valveLabelFromDecision(ns.decision);
        const valveBadge = getValveStatusBadge(valveLabel);
        const statusBadge = getNodeStatusBadge(node.status);

        return (
          <tr key={node.id}>
            <td>
              <span className="node-name">{node.name || node.id}</span>
              <small className="node-location">{node.location || ''}</small>
            </td>
            <td className="data-value">
              {offline || !reading ? '—' : `${reading.soil_moisture}%`}
            </td>
            <td className="data-value">
              {offline || !reading ? '—' : `${reading.soil_temp}${DEG_C}`}
            </td>
            <td><StatusBadge {...valveBadge} /></td>
            <td className="data-value">{offline ? '—' : `${node.battery ?? 0}%`}</td>
            <td><StatusBadge {...statusBadge} /></td>
            <td className="node-update">{timeAgo(node.updated_at)}</td>
          </tr>
        );
      })}
    </tbody>
  );
}

function NodeEmptyState() {
  return (
    <div className="fd-node-empty">
      <div className="fd-node-empty-icon">
        <i className="fas fa-satellite-dish" aria-hidden="true" />
      </div>
      <p className="fd-node-empty-title">Belum ada sensor terhubung</p>
      <p className="fd-node-empty-desc">Kebun ini belum memiliki node sensor yang terdaftar</p>
      <button type="button" className="btn btn-primary btn-sm">
        <i className="fas fa-plus" aria-hidden="true" /> Tambah Node Sensor Baru
      </button>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function FarmDetailPage() {
  const { id: farmId } = useParams();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    setError('');
    const { ok, status, data } = await getFarmSummary(farmId);
    setLoading(false);
    if (!ok) {
      if (status === 401) {
        signOut();
        navigate('/login', { replace: true });
        return;
      }
      if (status === 404) {
        setError('Kebun tidak ditemukan atau bukan milik akun Anda.');
        return;
      }
      setError(data.detail || `Gagal memuat ringkasan kebun (HTTP ${status}).`);
      return;
    }
    setSummary(data);
    if (data.farm?.id) setSelectedFarmId(data.farm.id);
  }, [farmId, navigate, signOut]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="page-content farm-detail-page">
          <div className="empty-state">
            <i className="fas fa-spinner fa-spin" /> Memuat data kebun...
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !summary) {
    return (
      <DashboardLayout>
        <div className="page-content farm-detail-page">
          <div className="empty-state">
            {error || 'Data tidak tersedia.'}
            <div style={{ marginTop: 16 }}>
              <Link className="btn btn-primary btn-sm" to="/dashboard">
                Kembali ke Daftar Kebun
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const farm = summary.farm || {};
  const nodes = summary.nodes || [];
  const warning =
    summary.nodes_problem > 0 ? `${summary.nodes_problem} node bermasalah` : null;

  return (
    <DashboardLayout>
      <div className="page-content farm-detail-page">
        <FarmInfoBar farm={farm} summary={summary} />
        <WarningCard message={warning} />

        <div className="fd-grid-3 mb-24">
          <SoilCard summary={summary} thresholds={summary.thresholds} />
          <GatewayCard summary={summary} farm={farm} />
          <WeatherCard summary={summary} />
        </div>

        <div className="card farm-node-card mb-24">
          <div className="farm-node-toolbar flex-between">
            <h3 className="farm-section-title">
              <i className="fas fa-microchip" aria-hidden="true" /> Status Node Sensor
            </h3>
            <Link
              className="btn btn-secondary btn-sm"
              to={`/farms/${encodeURIComponent(farmId)}/monitoring`}
            >
              <i className="fas fa-chart-area" aria-hidden="true" /> Lihat Monitoring
            </Link>
          </div>
          {nodes.length === 0 ? (
            <NodeEmptyState />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>Kelembapan</th>
                    <th>Suhu Tanah</th>
                    <th>Valve</th>
                    <th>Baterai</th>
                    <th>Status</th>
                    <th>Update</th>
                  </tr>
                </thead>
                <NodeRows nodes={nodes} />
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default FarmDetailPage;
