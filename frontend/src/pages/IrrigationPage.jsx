import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../layout/DashboardLayout';
import { getFarmSummary } from '../services/api';
import { setSelectedFarmId } from '../services/farms';

function deriveValveView(decision) {
  if (!decision) {
    return {
      type: 'unknown',
      text: 'TIDAK DIKETAHUI',
      stateClass: 'closed',
      decision: 'Perlu cek gateway',
      valveLabel: 'Tidak diketahui',
      reason: 'Belum ada data dari node aktif. Pastikan gateway online.',
    };
  }
  const type = decision.type || (decision.valve_state === 'open' ? 'open' : 'closed');
  const valveLabel = decision.valve_state === 'open' ? 'Terbuka' : 'Tertutup';
  const stateClass = type === 'open' ? 'open' : type === 'delayed' ? 'delayed' : 'closed';
  return {
    type,
    text: valveLabel.toUpperCase(),
    stateClass,
    decision: decision.decision || '—',
    valveLabel,
    reason: decision.reason || '',
  };
}

const LOGIC_ROWS = [
  {
    soil: 'Kelembapan < threshold bawah',
    weather: 'Tidak ada hujan',
    badgeClass: 'badge-green',
    action: 'Valve buka',
  },
  {
    soil: 'Kelembapan < threshold bawah',
    weather: 'Ada prediksi hujan',
    badgeClass: 'badge-yellow',
    action: 'Irigasi ditunda',
  },
  {
    soil: 'Kelembapan > threshold atas',
    weather: 'Apapun',
    badgeClass: 'badge-yellow',
    action: 'Valve tutup',
  },
  {
    soil: 'Kelembapan di antara threshold',
    weather: 'Apapun',
    badgeClass: 'badge-green',
    action: 'Normal, mengikuti status sebelumnya (Histeresis)',
  },
];

export function IrrigationPage() {
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
      setError(data.detail || `Gagal memuat data irigasi (HTTP ${status}).`);
      return;
    }
    setSummary(data);
    if (data.farm?.id) setSelectedFarmId(data.farm.id);
  }, [farmId, navigate, signOut]);

  useEffect(() => {
    load();
  }, [load]);

  const view = useMemo(() => {
    if (!summary) return deriveValveView(null);
    const activeNode = (summary.nodes || []).find(
      (ns) => ns.node && ns.node.status !== 'offline' && ns.decision,
    );
    return deriveValveView(activeNode?.decision || null);
  }, [summary]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="empty-state">
          <i className="fas fa-spinner fa-spin" /> Memuat status irigasi...
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

  return (
    <DashboardLayout>
      <div className="card status-big irrigation-control-card mb-24">
        <div className="irrigation-status-main">
          <div className={`valve-emblem ${view.stateClass}`} aria-hidden="true">
            <i className="fas fa-droplet" />
          </div>
          <div className="irrigation-status-copy">
            <span className="control-eyebrow">Status Valve</span>
            <div className={`valve-status ${view.stateClass}`}>{view.text}</div>
            <span className="control-mode-pill">
              <i className="fas fa-bolt" aria-hidden="true" /> Mode Otomatis
            </span>
          </div>
        </div>
      </div>

      <div className="card mb-24">
        <div className="table-wrap">
          <table className="logic-table">
            <thead>
              <tr>
                <th>Kondisi Tanah</th>
                <th>Kondisi Cuaca</th>
                <th>Aksi Sistem</th>
              </tr>
            </thead>
            <tbody>
              {LOGIC_ROWS.map((row, i) => (
                <tr key={i}>
                  <td>{row.soil}</td>
                  <td>{row.weather}</td>
                  <td>
                    <span className={`badge ${row.badgeClass}`}>{row.action}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card decision-panel mb-24">
        <div className="panel-row">
          <span className="panel-label">Keputusan Sistem</span>
          <span className="panel-value">{view.decision}</span>
        </div>
        <div className="panel-row">
          <span className="panel-label">Status Valve</span>
          <span className="panel-value">{view.valveLabel}</span>
        </div>
        {view.reason && (
          <div className="panel-row">
            <span className="panel-label">Alasan</span>
            <span className="panel-value">{view.reason}</span>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default IrrigationPage;
