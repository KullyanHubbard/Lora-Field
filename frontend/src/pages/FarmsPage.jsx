import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FarmCard } from '../components/FarmCard';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../layout/DashboardLayout';
import { listFarms } from '../services/api';
import { setSelectedFarmId } from '../services/farms';

/**
 * Daftar kebun tanpa peta. Port dari farms.html — versi sederhana
 * (alternatif Dashboard tanpa map).
 */
export function FarmsPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const { ok, status, data } = await listFarms();
    setLoading(false);
    if (!ok) {
      if (status === 401) {
        signOut();
        navigate('/login', { replace: true });
        return;
      }
      setLoadError(data.detail || `Gagal memuat kebun (HTTP ${status}).`);
      return;
    }
    setFarms(Array.isArray(data.items) ? data.items : []);
  }, [navigate, signOut]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visibleFarms = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return farms;
    return farms.filter(
      (f) =>
        (f.name || '').toLowerCase().includes(q) ||
        (f.location || '').toLowerCase().includes(q) ||
        (f.crop_type || '').toLowerCase().includes(q),
    );
  }, [farms, filter]);

  function handleOpen(farm) {
    const id = typeof farm === 'string' ? farm : farm?.id;
    if (!id) return;
    setSelectedFarmId(id);
    navigate(`/farms/${encodeURIComponent(id)}`);
  }

  return (
    <DashboardLayout>
      <div className="card toolbar-card mb-24">
        <div className="flex-between">
          <label className="search-box farm-search-list" htmlFor="farm-list-search">
            <i className="fas fa-search" aria-hidden="true" />
            <input
              type="text"
              id="farm-list-search"
              placeholder="Cari kebun, lokasi, atau tanaman"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
        </div>
      </div>

      <section className="farm-card-grid" aria-label="Daftar kebun">
        {loading ? (
          <div className="empty-state">
            <i className="fas fa-spinner fa-spin" /> Memuat data kebun...
          </div>
        ) : loadError ? (
          <div className="empty-state">{loadError}</div>
        ) : visibleFarms.length === 0 ? (
          <div className="empty-state">
            {filter ? 'Kebun tidak ditemukan.' : 'Belum ada kebun.'}
          </div>
        ) : (
          visibleFarms.map((farm) => (
            <FarmCard key={farm.id} farm={farm} onOpen={handleOpen} />
          ))
        )}
      </section>
    </DashboardLayout>
  );
}
