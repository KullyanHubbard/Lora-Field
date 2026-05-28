import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../layout/DashboardLayout';
import { getFarmSummary } from '../services/api';
import { setSelectedFarmId } from '../services/farms';
import { DEG_C, getWeatherInfo } from '../utils/farmHelpers';

const WEATHER_CODES = [
  { code: 0, label: 'Cerah', icon: 'fas fa-sun', isRain: false },
  { code: 1, label: 'Cerah Berawan', icon: 'fas fa-cloud-sun', isRain: false },
  { code: 2, label: 'Cerah Berawan', icon: 'fas fa-cloud-sun', isRain: false },
  { code: 3, label: 'Berawan', icon: 'fas fa-cloud', isRain: false },
  { code: 4, label: 'Berawan Tebal', icon: 'fas fa-cloud', isRain: false },
  { code: 60, label: 'Hujan Ringan', icon: 'fas fa-cloud-rain', isRain: true },
  { code: 61, label: 'Hujan Sedang', icon: 'fas fa-cloud-showers-heavy', isRain: true },
  { code: 63, label: 'Hujan Lebat', icon: 'fas fa-cloud-bolt', isRain: true },
];

const WEATHER_CODE_MAP = new Map(WEATHER_CODES.map((w) => [w.code, w]));

function pickNumber(...values) {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getWeatherCodeInfo(code, condition) {
  const num = Number(code);
  if (Number.isFinite(num) && WEATHER_CODE_MAP.has(num)) {
    return WEATHER_CODE_MAP.get(num);
  }
  const info = getWeatherInfo(condition);
  return { label: info.label, icon: info.icon, isRain: info.isRain };
}

function formatForecastLabel(item, index) {
  const rawTime = item.local_datetime || item.datetime || item.utc_datetime;
  if (!rawTime) return index === 0 ? 'Sekarang' : `+${index * 3} Jam`;
  const normalized = String(rawTime).replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    const timePart = String(rawTime).split(' ')[1];
    return timePart ? timePart.slice(0, 5) : index === 0 ? 'Sekarang' : `+${index * 3} Jam`;
  }
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildRegionText(weather, farm) {
  const r = weather?.region || {};
  const parts = [r.village || weather?.location, r.district, r.city, r.province].filter(Boolean);
  return parts.join(', ') || farm?.location || '—';
}

function buildCoordinateText(farm) {
  const lat = Number(farm?.latitude);
  const lng = Number(farm?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '—';
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function WeatherInfoCard({ weather, farm }) {
  const isAvailable = Boolean(weather);
  const region = buildRegionText(weather, farm);
  const adm4 = weather?.adm4 || farm?.bmkg_adm4_code || '—';
  const coord = buildCoordinateText(farm);
  const altitude = pickNumber(weather?.location_profile?.altitude_m);
  const altitudeText = altitude != null ? `${altitude} mdpl` : '—';
  const lastUpdate = weather?.forecast_time || weather?.updated_at || 'Belum tersedia';
  const statusLabel = isAvailable ? `${weather.provider || 'BMKG'} tersedia` : 'Belum tersedia';
  const statusClass = isAvailable ? 'badge-green' : 'badge-red';

  return (
    <div className="card mb-24">
      <div className="node-info-grid">
        <div className="node-info-item">
          <span className="info-label">Wilayah</span>
          <span className="info-value">{region}</span>
        </div>
        <div className="node-info-item">
          <span className="info-label">Kode BMKG</span>
          <span className="info-value">{adm4}</span>
        </div>
        <div className="node-info-item">
          <span className="info-label">Koordinat Kebun</span>
          <span className="info-value">{coord}</span>
        </div>
        <div className="node-info-item">
          <span className="info-label">Altitude BMKG</span>
          <span className="info-value">{altitudeText}</span>
        </div>
        <div className="node-info-item">
          <span className="info-label">Status Koneksi</span>
          <span className="info-value">
            <span className={`badge ${statusClass}`}>{statusLabel}</span>
          </span>
        </div>
        <div className="node-info-item">
          <span className="info-label">Update Terakhir</span>
          <span className="info-value">{lastUpdate}</span>
        </div>
      </div>
    </div>
  );
}

function WeatherMainCard({ weather, farm }) {
  const isAvailable = Boolean(weather);
  const info = getWeatherCodeInfo(weather?.code, weather?.condition);
  const temp = pickNumber(weather?.temperature);
  const humidity = pickNumber(weather?.humidity);
  const wind = pickNumber(weather?.wind_speed);
  const tempText = temp != null ? `${temp}${DEG_C}` : '—';
  const humText = humidity != null ? `${humidity}%` : '—';
  const windText =
    wind != null
      ? `${wind} km/jam${weather?.wind_direction ? ` (${weather.wind_direction})` : ''}`
      : '—';
  const locationText = isAvailable ? weather.location || farm?.location || '' : farm?.location || '';

  return (
    <div className="card weather-card mb-24">
      <div className="weather-main">
        <span className="weather-icon" aria-label={info.label}>
          <i className={info.icon} aria-hidden="true" />
        </span>
        <div>
          <div className="weather-temp">{tempText}</div>
          <div className="text-muted">{locationText}</div>
        </div>
      </div>
      <div className="weather-details">
        <div className="detail-row">
          <span className="detail-label">Kondisi</span>
          <span className="detail-value">{isAvailable ? weather.condition : 'Belum tersedia'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Kelembapan</span>
          <span className="detail-value">{humText}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Kecepatan Angin</span>
          <span className="detail-value">{windText}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Kode Cuaca</span>
          <span className="detail-value">{weather?.code ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}

function ForecastGrid({ forecast }) {
  if (!Array.isArray(forecast) || !forecast.length) {
    return (
      <div className="grid-3 forecast-section mb-24">
        <div className="card forecast-card">
          <div className="forecast-label">BMKG</div>
          <div className="forecast-cond">Prakiraan belum tersedia untuk kebun ini.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="grid-3 forecast-section mb-24">
      {forecast.slice(0, 8).map((f, i) => {
        const info = getWeatherCodeInfo(
          pickNumber(f.weather, f.code),
          f.weather_desc || f.condition,
        );
        const temp = pickNumber(f.t, f.temperature);
        const tempText = temp != null ? `${temp}${DEG_C}` : '—';
        return (
          <div key={i} className="card forecast-card">
            <div className="forecast-label">{formatForecastLabel(f, i)}</div>
            <div className="forecast-icon">
              <i className={info.icon} aria-hidden="true" />
            </div>
            <div className="forecast-temp">{tempText}</div>
            <div className="forecast-cond">{f.weather_desc || f.condition || '—'}</div>
          </div>
        );
      })}
    </div>
  );
}

function ImpactCard({ weather }) {
  if (!weather) {
    return (
      <div className="weather-impact deny mb-24">
        <i className="fas fa-triangle-exclamation" aria-hidden="true" /> Data BMKG belum tersedia.
        Pastikan kode BMKG kebun sudah terisi sesuai lokasi.
      </div>
    );
  }
  if (weather.rain_next_3h) {
    return (
      <div className="weather-impact deny mb-24">
        <i className="fas fa-cloud-rain" aria-hidden="true" /> BMKG memprediksi hujan, sistem
        menunda irigasi untuk mencegah pemborosan air.
      </div>
    );
  }
  return (
    <div className="weather-impact allow mb-24">
      <i className="fas fa-check-circle" aria-hidden="true" /> Tidak ada prediksi hujan, sistem
      mengizinkan irigasi jika kelembapan tanah berada di bawah threshold bawah.
    </div>
  );
}

export function WeatherPage() {
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
      setError(data.detail || `Gagal memuat data cuaca (HTTP ${status}).`);
      return;
    }
    setSummary(data);
    if (data.farm?.id) setSelectedFarmId(data.farm.id);
  }, [farmId, navigate, signOut]);

  useEffect(() => {
    load();
  }, [load]);

  const farm = useMemo(() => summary?.farm || null, [summary]);
  const weather = useMemo(() => summary?.weather || null, [summary]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="empty-state">
          <i className="fas fa-spinner fa-spin" /> Memuat data cuaca...
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
      <ImpactCard weather={weather} />
      <WeatherInfoCard weather={weather} farm={farm} />
      <WeatherMainCard weather={weather} farm={farm} />
      <ForecastGrid forecast={weather?.forecast} />
    </DashboardLayout>
  );
}
