import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../layout/DashboardLayout';
import { getFarmSummary, listNodeReadings } from '../services/api';
import { setSelectedFarmId } from '../services/farms';
import { DEG_C, getNodeStatusBadge, timeAgo } from '../utils/farmHelpers';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

const CHART_COLORS = {
  green: { border: '#0f9f6e', bg: 'rgba(15,159,110,0.18)' },
  blue: { border: '#2563eb', bg: 'rgba(37,99,235,0.18)' },
  orange: { border: '#ea580c', bg: 'rgba(234,88,12,0.18)' },
  cyan: { border: '#0891b2', bg: 'rgba(8,145,178,0.18)' },
};

function formatTimeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function buildChartData(label, values, labels, color) {
  return {
    labels,
    datasets: [
      {
        label,
        data: values,
        borderColor: color.border,
        backgroundColor: color.bg,
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBorderColor: color.border,
        pointBorderWidth: 2,
        pointHoverRadius: 5,
      },
    ],
  };
}

function buildChartOptions(yMin, yMax, unit) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y}${unit || ''}`,
        },
      },
    },
    scales: {
      x: { ticks: { font: { size: 10, weight: '600' } } },
      y: {
        min: yMin,
        max: yMax,
        ticks: {
          font: { size: 10, weight: '600' },
          callback: (value) => `${value}${unit || ''}`,
        },
      },
    },
    animation: { duration: 400, easing: 'easeOutQuart' },
  };
}

function MonitoringChart({ title, values, labels, color, yMin, yMax, unit }) {
  const data = useMemo(
    () => buildChartData(title, values, labels, color),
    [title, values, labels, color],
  );
  const options = useMemo(
    () => buildChartOptions(yMin, yMax, unit),
    [yMin, yMax, unit],
  );
  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
      </div>
      <div className="chart-wrap">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}

function ReadingTable({ rows, nodeName }) {
  if (!rows.length) {
    return (
      <tbody>
        <tr>
          <td colSpan={7} className="empty-table-cell">
            Belum ada data pembacaan sensor untuk node ini.
          </td>
        </tr>
      </tbody>
    );
  }
  return (
    <tbody>
      {rows.map((r) => {
        const badge = getNodeStatusBadge('online');
        return (
          <tr key={r.id}>
            <td className="data-value">{formatTimeLabel(r.created_at) || '—'}</td>
            <td>{nodeName}</td>
            <td className="data-value">{r.soil_moisture}%</td>
            <td className="data-value">
              {r.soil_temp}
              {DEG_C}
            </td>
            <td className="data-value">
              {r.air_temp}
              {DEG_C}
            </td>
            <td className="data-value">{r.air_humidity}%</td>
            <td>
              <span className={`badge ${badge.className}`}>{badge.label}</span>
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}

export function MonitoringPage() {
  const { id: farmId } = useParams();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [summary, setSummary] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [readings, setReadings] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingReadings, setLoadingReadings] = useState(false);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    if (!farmId) return;
    setLoadingSummary(true);
    setError('');
    const { ok, status, data } = await getFarmSummary(farmId);
    setLoadingSummary(false);
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
      setError(data.detail || `Gagal memuat data kebun (HTTP ${status}).`);
      return;
    }
    setSummary(data);
    if (data.farm?.id) setSelectedFarmId(data.farm.id);
    const firstNode = (data.nodes || []).find((ns) => ns.node)?.node;
    if (firstNode) setSelectedNodeId((prev) => prev || firstNode.id);
  }, [farmId, navigate, signOut]);

  const loadReadings = useCallback(async () => {
    if (!selectedNodeId) {
      setReadings([]);
      return;
    }
    setLoadingReadings(true);
    const { ok, data } = await listNodeReadings(selectedNodeId, 20);
    setLoadingReadings(false);
    if (!ok) {
      setReadings([]);
      return;
    }
    setReadings(data.items || []);
  }, [selectedNodeId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadReadings();
  }, [loadReadings]);

  const nodes = useMemo(
    () => (summary?.nodes || []).map((ns) => ns.node).filter(Boolean),
    [summary],
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  // Readings ascending (lama → baru) untuk chart, dan descending (baru → lama) untuk tabel.
  const readingsAsc = useMemo(() => [...readings].reverse(), [readings]);
  const chartLabels = useMemo(
    () => readingsAsc.map((r) => formatTimeLabel(r.created_at)),
    [readingsAsc],
  );
  const soilMoistureData = readingsAsc.map((r) => r.soil_moisture);
  const soilTempData = readingsAsc.map((r) => r.soil_temp);
  const airTempData = readingsAsc.map((r) => r.air_temp);
  const airHumidityData = readingsAsc.map((r) => r.air_humidity);

  if (loadingSummary) {
    return (
      <DashboardLayout>
        <div className="empty-state">
          <i className="fas fa-spinner fa-spin" /> Memuat data monitoring...
        </div>
      </DashboardLayout>
    );
  }

  if (error || !summary) {
    return (
      <DashboardLayout>
        <div className="empty-state">
          {error || 'Data tidak tersedia.'}
          <div style={{ marginTop: 16 }}>
            <Link className="btn btn-primary btn-sm" to="/dashboard">
              Kembali ke Daftar Kebun
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const tableRows = readings.slice(0, 10);
  const nodeName = selectedNode
    ? `${selectedNode.name}${selectedNode.location ? ` - ${selectedNode.location}` : ''}`
    : '—';

  return (
    <DashboardLayout>
      <div className="card toolbar-card mb-24">
        <div className="flex-between">
          <div className="toolbar-controls">
            <div className="form-group">
              <label htmlFor="filter-node">Node</label>
              <select
                className="form-control"
                id="filter-node"
                value={selectedNodeId}
                onChange={(e) => setSelectedNodeId(e.target.value)}
                disabled={!nodes.length}
              >
                {!nodes.length && <option value="">Tidak ada node</option>}
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} {n.location ? `- ${n.location}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={loadReadings}
            disabled={!selectedNodeId || loadingReadings}
          >
            <i
              className={`fas ${loadingReadings ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}
              aria-hidden="true"
            />{' '}
            Muat Ulang Data
          </button>
        </div>
      </div>

      <div className="grid-2 mb-24">
        <MonitoringChart
          title="Kelembapan Tanah"
          values={soilMoistureData}
          labels={chartLabels}
          color={CHART_COLORS.green}
          yMin={0}
          yMax={100}
          unit="%"
        />
        <MonitoringChart
          title="Suhu Tanah"
          values={soilTempData}
          labels={chartLabels}
          color={CHART_COLORS.orange}
          yMin={15}
          yMax={45}
          unit={DEG_C}
        />
        <MonitoringChart
          title="Suhu Udara"
          values={airTempData}
          labels={chartLabels}
          color={CHART_COLORS.cyan}
          yMin={15}
          yMax={45}
          unit={DEG_C}
        />
        <MonitoringChart
          title="Kelembapan Udara"
          values={airHumidityData}
          labels={chartLabels}
          color={CHART_COLORS.blue}
          yMin={0}
          yMax={100}
          unit="%"
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Node</th>
                <th>Kelembapan Tanah</th>
                <th>Suhu Tanah</th>
                <th>Suhu Udara</th>
                <th>Kelembapan Udara</th>
                <th>Status</th>
              </tr>
            </thead>
            <ReadingTable rows={tableRows} nodeName={nodeName} />
          </table>
        </div>
        {selectedNode && (
          <div className="card-footer-meta">
            <small className="text-muted">
              Last update node: {timeAgo(selectedNode.updated_at)}
            </small>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
