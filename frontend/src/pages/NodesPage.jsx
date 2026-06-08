import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../layout/DashboardLayout';
import { getFarmSummary } from '../services/api';
import { setSelectedFarmId } from '../services/farms';
import { getNodeStatusBadge, timeAgo } from '../utils/farmHelpers';

export function NodesPage() {
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
      setError(data.detail || `Gagal memuat data node (HTTP ${status}).`);
      return;
    }
    setSummary(data);
    if (data.farm?.id) setSelectedFarmId(data.farm.id);
  }, [farmId, navigate, signOut]);

  useEffect(() => {
    load();
  }, [load]);

  const nodes = useMemo(
    () => (summary?.nodes || []).map((ns) => ns.node).filter(Boolean),
    [summary],
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="empty-state">
          <i className="fas fa-spinner fa-spin" /> Memuat data node...
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
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Node</th>
                <th>Lokasi Titik</th>
                <th>Status</th>
                <th>Baterai</th>
                <th>RSSI LoRa</th>
                <th>Update Terakhir</th>
              </tr>
            </thead>
            <tbody>
              {nodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-table-cell">
                    Belum ada node terdaftar untuk kebun ini.
                  </td>
                </tr>
              ) : (
                nodes.map((node) => {
                  const badge = getNodeStatusBadge(node.status);
                  const rssi = node.rssi;
                  return (
                    <tr key={node.id}>
                      <td>{node.name || node.id}</td>
                      <td>{node.location || '—'}</td>
                      <td>
                        <span className={`badge ${badge.className}`}>{badge.label}</span>
                      </td>
                      <td className="data-value">
                        {node.battery != null ? `${node.battery}%` : '—'}
                      </td>
                      <td className="data-value">
                        {rssi != null ? `${rssi} dBm` : '—'}
                      </td>
                      <td>{timeAgo(node.updated_at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default NodesPage;
