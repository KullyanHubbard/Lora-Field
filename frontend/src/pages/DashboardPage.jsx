import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FarmCard } from '../components/FarmCard';
import { FarmMap } from '../components/FarmMap';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../layout/DashboardLayout';
import { deleteFarm as apiDeleteFarm, listFarms } from '../services/api';
import { getSelectedFarmId, setSelectedFarmId } from '../services/farms';

export function DashboardPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState(() => getSelectedFarmId());
  const [confirmFarm, setConfirmFarm] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  // Filter farms berdasarkan keyword (nama / lokasi / crop). Case-insensitive.
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

  // Kalau selected farm tidak ada di list (mis. baru dihapus user lain),
  // bersihkan biar tidak ada stale highlight.
  useEffect(() => {
    if (!selectedId) return;
    if (!farms.some((f) => f.id === selectedId)) {
      setSelectedId('');
      setSelectedFarmId('');
    }
  }, [farms, selectedId]);

  function handleSelect(id) {
    setSelectedId(id);
    setSelectedFarmId(id);
  }

  function handleOpen(farm) {
    const id = typeof farm === 'string' ? farm : farm?.id;
    if (!id) return;
    setSelectedFarmId(id);
    navigate(`/farms/${encodeURIComponent(id)}`);
  }

  function requestDelete(farm) {
    setConfirmFarm(farm);
  }

  async function confirmDelete() {
    if (!confirmFarm) return;
    const farmId = confirmFarm.id;
    setDeleting(true);
    const { ok, status } = await apiDeleteFarm(farmId);
    setDeleting(false);
    setConfirmFarm(null);
    if (!ok) {
      if (status === 401) {
        signOut();
        navigate('/login', { replace: true });
        return;
      }
      setLoadError(`Gagal menghapus kebun (HTTP ${status}).`);
      return;
    }
    if (selectedId === farmId) {
      setSelectedId('');
      setSelectedFarmId('');
    }
    refresh();
  }

  return (
    <DashboardLayout>
      <section className="field-map-panel mb-24" aria-label="Peta pemilihan kebun">
        <div className="farm-map-toolbar">
          <label className="search-box farm-search" htmlFor="farm-search">
            <i className="fas fa-search" aria-hidden="true" />
            <input
              type="text"
              id="farm-search"
              placeholder="Cari nama kebun, lokasi, atau tanaman"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <Link className="btn btn-primary btn-sm" to="/farms/add">
            <i className="fas fa-plus" aria-hidden="true" /> Tambah Kebun
          </Link>
        </div>

        <FarmMap
          farms={visibleFarms}
          selectedId={selectedId}
          onSelect={handleSelect}
          onOpen={handleOpen}
        />
      </section>

      <section className="farm-card-grid" aria-label="Daftar kebun milik user">
        {loading ? (
          <div className="empty-state">
            <i className="fas fa-spinner fa-spin" /> Memuat data kebun...
          </div>
        ) : loadError ? (
          <div className="empty-state">{loadError}</div>
        ) : visibleFarms.length === 0 ? (
          <div className="empty-state">
            {filter ? 'Kebun tidak ditemukan.' : 'Belum ada kebun. Klik "Tambah Kebun" untuk memulai.'}
          </div>
        ) : (
          visibleFarms.map((farm) => (
            <FarmCard
              key={farm.id}
              farm={farm}
              selected={farm.id === selectedId}
              onOpen={handleOpen}
              onDelete={requestDelete}
            />
          ))
        )}
      </section>

      <ConfirmDialog
        open={Boolean(confirmFarm)}
        title="Hapus Kebun"
        body={
          confirmFarm
            ? `Yakin ingin menghapus kebun "${confirmFarm.name}"? Data kebun akan hilang permanen dan tidak bisa dikembalikan.`
            : ''
        }
        confirmLabel={deleting ? 'Menghapus...' : 'Ya, Hapus'}
        cancelLabel="Batal"
        onConfirm={deleting ? undefined : confirmDelete}
        onCancel={deleting ? undefined : () => setConfirmFarm(null)}
      />
    </DashboardLayout>
  );
}
