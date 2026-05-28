import { useEffect, useRef, useState } from 'react';
import { resolveAdm4 } from '../services/api';

const GEO_OPTIONS = { timeout: 20000, enableHighAccuracy: true, maximumAge: 0 };

const GEO_ERRORS = {
  1: 'Izin lokasi ditolak. Klik ikon lokasi di browser lalu izinkan akses lokasi.',
  2: 'GPS tidak tersedia di perangkat ini.',
  3: 'Gagal mendeteksi lokasi. Pastikan GPS aktif dan coba lagi.',
};

/**
 * Field koordinat dengan tombol deteksi GPS + auto-resolve BMKG ADM4.
 *
 * Props:
 *   lat, lng           — string (controlled, kosong = belum diisi)
 *   onLatChange(str)
 *   onLngChange(str)
 *   onAdm4Change(str)  — dipanggil tiap kali ADM4 berubah (termasuk reset jadi '')
 *   locationHint       — string, dipakai backend resolver sebagai fallback
 *   autoDetectOnMount  — bool, default true (sesuai HTML lama)
 *
 * Catatan:
 *   - User edit manual lat/lng → komponen kirim onAdm4Change('') agar
 *     ADM4 lama tidak dikira valid untuk koordinat baru.
 *   - Detect button menjalankan geolocation + resolveAdm4 berurutan.
 */
export function LocationDetector({
  lat,
  lng,
  onLatChange,
  onLngChange,
  onAdm4Change,
  locationHint = '',
  autoDetectOnMount = true,
}) {
  const [detecting, setDetecting] = useState(false);
  const [status, setStatus] = useState({ message: '', type: '' });
  const requestRef = useRef(null);
  const autoTriggeredRef = useRef(false);

  function setMsg(message, type = '') {
    setStatus({ message, type });
  }

  async function resolveAndUpdate(coords, accText) {
    const { ok, data } = await resolveAdm4(coords.lat, coords.lng, locationHint);
    if (ok && data.found && data.adm4) {
      onAdm4Change(data.adm4);
      setMsg(`Lokasi terdeteksi: ${coords.lat}, ${coords.lng} · ${accText} · Wilayah BMKG: ${data.adm4}`);
      return data.adm4;
    }
    onAdm4Change('');
    setMsg(
      'Lokasi terdeteksi, tapi kode BMKG belum ditemukan. Isi alamat sampai desa/kecamatan/kabupaten lalu coba lagi.',
      'warning',
    );
    return '';
  }

  function detect(mode = 'manual') {
    if (requestRef.current) return requestRef.current;
    if (!navigator.geolocation) {
      setMsg('Browser tidak mendukung deteksi lokasi.', 'error');
      return Promise.resolve(null);
    }

    setDetecting(true);
    setMsg(mode === 'auto' ? 'Mendeteksi lokasi otomatis...' : 'Mendeteksi lokasi...');

    const promise = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const acc = Math.round(pos.coords.accuracy || 0);
          const detectedLat = parseFloat(pos.coords.latitude.toFixed(6));
          const detectedLng = parseFloat(pos.coords.longitude.toFixed(6));
          onLatChange(String(detectedLat));
          onLngChange(String(detectedLng));
          onAdm4Change('');

          const accText = acc ? `GPS (±${acc}m)` : 'GPS';
          setMsg(
            `Lokasi terdeteksi: ${detectedLat}, ${detectedLng} · ${accText} · Mengidentifikasi wilayah BMKG...`,
          );

          try {
            const adm4 = await resolveAndUpdate({ lat: detectedLat, lng: detectedLng }, accText);
            resolve({ lat: detectedLat, lng: detectedLng, adm4 });
          } catch (_) {
            setMsg('Lokasi terdeteksi, tapi gagal menghubungkan ke resolver BMKG.', 'warning');
            resolve({ lat: detectedLat, lng: detectedLng, adm4: '' });
          }
        },
        (err) => {
          setMsg(GEO_ERRORS[err.code] || 'Gagal mendeteksi lokasi.', 'error');
          resolve(null);
        },
        GEO_OPTIONS,
      );
    }).finally(() => {
      setDetecting(false);
      requestRef.current = null;
    });

    requestRef.current = promise;
    return promise;
  }

  // Auto-detect saat mount kalau coords masih kosong.
  useEffect(() => {
    if (!autoDetectOnMount) return undefined;
    if (autoTriggeredRef.current) return undefined;
    autoTriggeredRef.current = true;
    const handle = window.setTimeout(() => {
      if (!lat && !lng) detect('auto');
    }, 350);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLatInput(value) {
    onLatChange(value);
    onAdm4Change('');
  }

  function handleLngInput(value) {
    onLngChange(value);
    onAdm4Change('');
  }

  const statusColor =
    status.type === 'error'
      ? 'var(--color-danger, #ef4444)'
      : status.type === 'warning'
        ? 'var(--color-warning, #f59e0b)'
        : '';

  return (
    <>
      <div className="settings-form-row">
        <div className="form-group">
          <label htmlFor="farm-lat-auto">Latitude</label>
          <input
            className="form-control"
            type="number"
            id="farm-lat-auto"
            placeholder="Contoh: -7.8014"
            min={-90}
            max={90}
            step="any"
            value={lat}
            onChange={(e) => handleLatInput(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="farm-lng-auto">Longitude</label>
          <input
            className="form-control"
            type="number"
            id="farm-lng-auto"
            placeholder="Contoh: 110.3647"
            min={-180}
            max={180}
            step="any"
            value={lng}
            onChange={(e) => handleLngInput(e.target.value)}
          />
        </div>
      </div>

      <div className="coord-auto-panel">
        <button
          type="button"
          className="btn btn-secondary"
          id="detect-location-btn"
          onClick={() => detect('manual')}
          disabled={detecting}
          aria-busy={detecting || undefined}
        >
          <i className="fas fa-location-dot" aria-hidden="true" /> Deteksi Lokasi Sekarang
        </button>
        <p className="coord-auto-status" aria-live="polite" style={{ color: statusColor }}>
          {status.message}
        </p>
      </div>
    </>
  );
}

/**
 * Standalone helper untuk re-resolve ADM4 dari (lat, lng, hint) tanpa
 * lewat komponen — dipakai AddFarmPage saat submit jika ADM4 belum ada.
 */
export async function resolveAdm4FromCoords(lat, lng, locationHint = '') {
  const { ok, data } = await resolveAdm4(lat, lng, locationHint);
  if (ok && data.found && data.adm4) return data.adm4;
  return '';
}
