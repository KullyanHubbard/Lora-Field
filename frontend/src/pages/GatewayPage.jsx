import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../layout/DashboardLayout';
import { getFarmSummary } from '../services/api';
import { setSelectedFarmId } from '../services/farms';
import { getFarmLastUpdate, getGatewayStatusBadge, timeAgo } from '../utils/farmHelpers';

export function GatewayPage() {
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
      setError(data.detail || `Gagal memuat data gateway (HTTP ${status}).`);
      return;
    }
    setSummary(data);
    if (data.farm?.id) setSelectedFarmId(data.farm.id);
  }, [farmId, navigate, signOut]);

  useEffect(() => {
    load();
  }, [load]);

  const row = useMemo(() => {
    if (!summary?.farm) return null;
    const farm = summary.farm;
    const gwBadge = getGatewayStatusBadge(summary.gateway_status);
    const lastSeen = getFarmLastUpdate(farm, summary.nodes || []);
    return {
      id: `gw-${farm.id}`,
      badge: gwBadge,
      internet: '4G LTE',
      quality: 'Baik',
      nodesActive: summary.nodes_online ?? 0,
      nodesTotal: summary.nodes_total ?? 0,
      lastSeen,
    };
  }, [summary]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="empty-state">
          <i className="fas fa-spinner fa-spin" /> Memuat data gateway...
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
                <th>ID Gateway</th>
                <th>Status</th>
                <th>Internet</th>
                <th>Node</th>
                <th>Kualitas</th>
                <th>Terakhir Terlihat</th>
              </tr>
            </thead>
            <tbody>
              {row ? (
                <tr>
                  <td className="data-value">{row.id}</td>
                  <td>
                    <span className={`badge ${row.badge.className}`}>{row.badge.label}</span>
                  </td>
                  <td>{row.internet}</td>
                  <td>
                    {row.nodesActive}/{row.nodesTotal}
                  </td>
                  <td>{row.quality}</td>
                  <td>{timeAgo(row.lastSeen)}</td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={6} className="empty-table-cell">
                    Gateway belum tersedia.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default GatewayPage;
