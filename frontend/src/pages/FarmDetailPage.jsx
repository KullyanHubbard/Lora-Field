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

function FarmInfoBar({ farm, summary }) {
  const lastUpd = getFarmLastUpdate(farm, summary.nodes || []);
  const gwBadge = getGatewayStatusBadge(summary.gateway_status);
  const farmBadge = farm.status === 'warning'
    ? { className: 'badge-yellow', label: 'Perlu Perhatian' }
    : { className: 'badge-green', label: 'Normal' };

  return (
    <div className="card farm-info-card mb-24">
      <div className="farm-info-row">
        <div className="farm-info-main">
          <h2 className="farm-title">{farm.name}</h2>
          <p className="farm-meta">
            <i className="fas fa-leaf" aria-hidden="true" /> {farm.crop_type || '—'}
            &nbsp;&middot;&nbsp;
            <i className="fas fa-ruler-combined" aria-hidden="true" /> {formatAreaHa(farm.area_ha)}
            &nbsp;&middot;&nbsp;
            <i className="fas fa-location-dot" aria-hidden="true" /> {farm.location || '—'}
            &nbsp;&middot;&nbsp;
            Update: {timeAgo(lastUpd)}
          </p>
        </div>
        <div className="farm-badges">
          <StatusBadge {...farmBadge} />
          <span className={`badge ${gwBadge.className}`}>
            <i className="fas fa-tower-broadcast" aria-hidden="true" /> {gwBadge.label}
          </span>
        </div>
      </div>
    </div>
  );
}

function WarningCard({ message }) {
  if (!message) return null;
  return (
    <div className="card farm-warning-card mb-24">
      <div className="farm-warning-text">
        <span>
          <i className="fas fa-triangle-exclamation farm-warning-icon" aria-hidden="true" /> {message}
        </span>
      </div>
    </div>
  );
}

function StatSoilIrrigation({ summary, thresholds }) {
  const avg = summary.average_soil_moisture;
  const lower = thresholds?.lower ?? 40;
  const upper = thresholds?.upper ?? 70;
  const soilBadge = getSoilStatusFromMoisture(avg, lower, upper);

  // Ambil decision dari node aktif pertama (server-side decision).
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
    <div className="card" id="stat-soil-irrigation">
      <div className="card-header">
        <h3>
          <i className="fas fa-droplet" aria-hidden="true" /> Kelembapan &amp; Irigasi
        </h3>
      </div>
      <div className="farm-card-body">
        <div>
          <span>Kelembapan Rata-rata</span>
          <strong className="data-value">{avg != null ? `${avg}%` : '—'}</strong>
        </div>
        <div>
          <span>Status Tanah</span>
          <StatusBadge {...soilBadge} />
        </div>
        <div>
          <span>Status Irigasi</span>
          <StatusBadge {...irrigBadge} />
        </div>
        <div>
          <span>Status Valve</span>
          <StatusBadge {...valveBadge} />
        </div>
      </div>
    </div>
  );
}

function StatGatewayWeather({ summary, farm }) {
  const gwBadge = getGatewayStatusBadge(summary.gateway_status);
  const weather = summary.weather;
  const condition = weather?.condition || 'Belum tersedia';
  const weatherInfo = getWeatherInfo(condition);
  const tempRaw = weather?.temperature;
  const temp =
    tempRaw != null && Number.isFinite(Number(tempRaw)) ? `${tempRaw}${DEG_C}` : '—';
  const rainBadge = !weather
    ? { label: 'Cuaca Belum Tersedia', className: 'badge-red' }
    : weather.rain_next_3h
      ? { label: 'Prediksi Hujan', className: 'badge-yellow' }
      : { label: 'Tidak Ada Hujan', className: 'badge-green' };

  return (
    <div className="card" id="stat-gateway-weather">
      <div className="card-header">
        <h3>
          <i className="fas fa-tower-broadcast" aria-hidden="true" /> Gateway &amp; Cuaca
        </h3>
      </div>
      <div className="farm-card-body">
        <div>
          <span>Status Gateway</span>
          <StatusBadge {...gwBadge} />
        </div>
        <div>
          <span>Terakhir Online</span>
          <strong>{timeAgo(farm.updated_at)}</strong>
        </div>
        <div>
          <span>Kondisi Cuaca</span>
          <strong className="data-value">
            <i className={weatherInfo.icon} aria-hidden="true" />{' '}
            {weather ? condition : 'Belum tersedia'}
          </strong>
        </div>
        <div>
          <span>Suhu Udara</span>
          <strong className="data-value">{temp}</strong>
        </div>
        <div>
          <span>Prediksi Hujan (3 jam)</span>
          <StatusBadge {...rainBadge} />
        </div>
      </div>
    </div>
  );
}

function NodeTable({ nodes, monitoringHref }) {
  if (!nodes.length) {
    return (
      <tbody>
        <tr>
          <td colSpan={7} className="empty-table-cell">
            Tidak ada node terdaftar.
          </td>
        </tr>
      </tbody>
    );
  }

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
            <td>
              <StatusBadge {...valveBadge} />
            </td>
            <td className="data-value">
              {offline ? '—' : `${node.battery ?? 0}%`}
            </td>
            <td>
              <StatusBadge {...statusBadge} />
            </td>
            <td className="node-update">{timeAgo(node.updated_at)}</td>
          </tr>
        );
      })}
    </tbody>
  );
}

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

        <div className="grid-2 farm-detail-grid mb-24">
          <StatSoilIrrigation summary={summary} thresholds={summary.thresholds} />
          <StatGatewayWeather summary={summary} farm={farm} />
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
              <NodeTable nodes={nodes} />
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default FarmDetailPage;
