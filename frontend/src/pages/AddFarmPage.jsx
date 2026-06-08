import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CropDropdown } from '../components/CropDropdown';
import { LocationDetector, resolveAdm4FromCoords } from '../components/LocationDetector';
import { useAuth } from '../context/AuthContext';
import { AuthPageLayout } from '../layout/AuthPageLayout';
import { createFarm, listFarms } from '../services/api';
import { setSelectedFarmId } from '../services/farms';

export function AddFarmPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [location, setLocation] = useState('');
  const [cropType, setCropType] = useState('');
  const [areaHa, setAreaHa] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [adm4, setAdm4] = useState('');

  const [existingCount, setExistingCount] = useState(0);
  const [forceSubmit, setForceSubmit] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  // Prefill owner dari user yang login.
  useEffect(() => {
    if (user?.name && !owner) {
      setOwner(user.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  // Ambil count farm untuk auto-naming "Kebun N+1".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { ok, data } = await listFarms();
      if (cancelled) return;
      if (ok) {
        const items = Array.isArray(data.items) ? data.items : [];
        setExistingCount(items.length);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lokasi text berubah → ADM4 stale, reset.
  function handleLocationChange(value) {
    setLocation(value);
    if (adm4) setAdm4('');
  }

  function setMsg(message, type) {
    setFeedback({ message, type });
  }

  function parseCoords() {
    const parsedLat = lat !== '' ? parseFloat(lat) : null;
    const parsedLng = lng !== '' ? parseFloat(lng) : null;
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      return { lat: null, lng: null };
    }
    return { lat: parsedLat, lng: parsedLng };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const rawName = name.trim();
    const effectiveName = rawName || `Kebun ${existingCount + 1}`;
    if (!rawName) setName(effectiveName);

    const trimmedLocation = location.trim();
    const trimmedCrop = cropType.trim();

    // Validasi field yang "lengkap untuk monitoring optimal".
    const missing = [];
    if (!trimmedLocation) missing.push('Lokasi');
    if (!trimmedCrop) missing.push('Jenis Tanaman');
    if (areaHa === '') missing.push('Luas Lahan');

    if (missing.length && !forceSubmit) {
      setMissingFields(missing);
      setForceSubmit(true);
      setMsg('', '');
      return;
    }
    setMissingFields([]);

    let { lat: coordLat, lng: coordLng } = parseCoords();

    if (coordLat === null || coordLng === null) {
      setMsg(
        'Lokasi kebun belum terdeteksi. Izinkan akses lokasi browser atau isi koordinat kebun.',
        'error',
      );
      return;
    }

    // Re-resolve ADM4 di submit kalau belum ada — backend tolak 422 kalau gagal.
    let resolvedAdm4 = adm4.trim();
    if (!resolvedAdm4) {
      try {
        resolvedAdm4 = await resolveAdm4FromCoords(coordLat, coordLng, trimmedLocation);
      } catch (_) {
        resolvedAdm4 = '';
      }
    }
    if (!resolvedAdm4) {
      setMsg(
        'Kode BMKG belum otomatis terdeteksi. Isi lokasi sampai nama desa, kecamatan, dan kabupaten, lalu klik Deteksi Lokasi Sekarang.',
        'error',
      );
      return;
    }

    const payload = {
      name: effectiveName,
      owner: owner.trim(),
      location: trimmedLocation,
      crop_type: trimmedCrop,
      area_ha: areaHa !== '' ? parseFloat(areaHa) : null,
      bmkg_adm4_code: resolvedAdm4,
      latitude: coordLat,
      longitude: coordLng,
    };

    setSubmitting(true);
    const { ok, status, data } = await createFarm(payload);

    if (!ok) {
      setSubmitting(false);
      if (status === 401) {
        signOut();
        navigate('/login', { replace: true });
        return;
      }
      setMsg(data.detail || `Gagal menambah kebun (HTTP ${status}).`, 'error');
      return;
    }

    const createdFarm = data.farm || {};
    if (createdFarm.id) setSelectedFarmId(createdFarm.id);
    // Tidak set setSubmitting(false) di sini supaya tombol tetap disabled
    // sampai navigate selesai (mencegah double-submit).
    navigate('/dashboard', { replace: true });
  }

  const submitLabel = forceSubmit && missingFields.length ? 'Tetap Simpan' : 'Tambah Kebun';

  return (
    <AuthPageLayout showBrandBar={false}>
      <main className="add-farm-shell" aria-labelledby="add-farm-title">
      <section className="add-farm-card" aria-label="Form tambah kebun">
        <div className="add-farm-header">
          <Link className="add-farm-back" to="/dashboard" aria-label="Kembali">
            <i className="fas fa-arrow-left" aria-hidden="true" />
          </Link>
          <h1 id="add-farm-title">Tambah Kebun</h1>
        </div>

        <form className="add-farm-form" onSubmit={handleSubmit} noValidate>
          <p className="settings-subsection-label">Profil Kebun</p>

          <div className="settings-form-row">
            <div className="form-group">
              <label htmlFor="farm-name">Nama Kebun</label>
              <input
                className="form-control"
                type="text"
                id="farm-name"
                name="name"
                placeholder="Biarkan kosong untuk nama otomatis"
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="farm-owner">Pemilik Kebun</label>
              <input
                className="form-control"
                type="text"
                id="farm-owner"
                name="owner"
                placeholder="Nama pemilik"
                maxLength={100}
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>
          </div>

          <div className="settings-form-row">
            <div className="form-group">
              <label htmlFor="farm-location">Lokasi / Alamat</label>
              <input
                className="form-control"
                type="text"
                id="farm-location"
                name="location"
                placeholder="Contoh: Jl. Parangtritis, Bantul"
                maxLength={200}
                value={location}
                onChange={(e) => handleLocationChange(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="farm-crop-input">Jenis Tanaman</label>
              <CropDropdown value={cropType} onChange={setCropType} />
            </div>
          </div>

          <div className="settings-form-row">
            <div className="form-group">
              <label htmlFor="farm-area">Luas Lahan (ha)</label>
              <input
                className="form-control"
                type="number"
                id="farm-area"
                name="area_ha"
                placeholder="Contoh: 1.5"
                min={0}
                step="0.01"
                value={areaHa}
                onChange={(e) => setAreaHa(e.target.value)}
              />
            </div>
          </div>

          <p className="settings-subsection-label settings-subsection-label-gap">Koordinat Kebun</p>

          <LocationDetector
            lat={lat}
            lng={lng}
            onLatChange={setLat}
            onLngChange={setLng}
            onAdm4Change={setAdm4}
            locationHint={location}
            autoDetectOnMount
          />

          <p className="settings-form-note">
            <i className="fas fa-circle-info" aria-hidden="true" /> Koordinat digunakan untuk
            menampilkan kebun di peta. Kosongkan jika belum tersedia.
          </p>

          {missingFields.length ? (
            <div className="farm-incomplete-notice">
              <i className="fas fa-circle-info" aria-hidden="true" />
              <div>
                <strong>Data kebun belum lengkap.</strong>
                <span> {missingFields.join(', ')} belum diisi. </span>
                Lengkapi data ini untuk hasil monitoring yang optimal.
              </div>
            </div>
          ) : null}

          {feedback.message ? (
            <p
              className={`forgot-feedback forgot-feedback-${feedback.type}`}
              role="status"
              aria-live="polite"
            >
              {feedback.message}
            </p>
          ) : null}

          <div className="add-farm-actions">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting}
              aria-busy={submitting || undefined}
            >
              <i className="fas fa-plus" aria-hidden="true" /> {submitLabel}
            </button>
            <Link className="btn btn-secondary" to="/dashboard">
              Batal
            </Link>
          </div>
        </form>
      </section>
      </main>
    </AuthPageLayout>
  );
}

export default AddFarmPage;
