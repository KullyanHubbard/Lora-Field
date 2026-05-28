/**
 * Helper murni untuk render data farm di React.
 * Diport dari main.js (versi HTML lama). Tidak punya side effect ke DOM
 * atau localStorage — semua input dari argument.
 */

export const DEG_C = '°C';

// -----------------------------------------------------------
// Time
// -----------------------------------------------------------

export function timeAgo(date) {
  if (!date) return 'Tidak tersedia';
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return 'Tidak tersedia';
  const diff = Math.max(Math.floor((Date.now() - timestamp) / 1000), 0);
  if (diff < 5) return 'Baru saja';
  if (diff < 60) return `${diff} detik lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

// -----------------------------------------------------------
// Badge mappers (selalu return { label, className })
// -----------------------------------------------------------

export function getGatewayStatusBadge(status) {
  const map = {
    online: { label: 'Online', className: 'badge-green' },
    offline: { label: 'Offline', className: 'badge-red' },
    degraded: { label: 'Gangguan', className: 'badge-yellow' },
  };
  return map[status] || map.offline;
}

export function getNodeStatusBadge(status) {
  const map = {
    online: { label: 'Online', className: 'badge-green' },
    standby: { label: 'Standby', className: 'badge-yellow' },
    offline: { label: 'Offline', className: 'badge-red' },
  };
  return map[status] || map.offline;
}

export function getValveStatusBadge(valveLabel) {
  const map = {
    Terbuka: { label: 'Terbuka', className: 'badge-green' },
    Tertutup: { label: 'Tertutup', className: 'badge-yellow' },
    'Tidak diketahui': { label: 'Tidak diketahui', className: 'badge-red' },
  };
  return map[valveLabel] || map['Tidak diketahui'];
}

export function getIrrigationStatusBadge(label) {
  if (label === 'Aktif' || label === 'Irigasi aktif' || label === 'Normal') {
    return { label, className: 'badge-green' };
  }
  if (label === 'Perlu cek gateway') {
    return { label, className: 'badge-red' };
  }
  return { label: label || 'Perlu cek', className: 'badge-yellow' };
}

export function getSoilStatusFromMoisture(value, lower = 40, upper = 70) {
  if (value == null || value <= 0) {
    return { label: 'Tidak Ada Data', className: 'badge-red' };
  }
  if (value < lower) return { label: 'Butuh Irigasi', className: 'badge-red' };
  if (value > upper) return { label: 'Terlalu Basah', className: 'badge-yellow' };
  return { label: 'Normal', className: 'badge-green' };
}

// -----------------------------------------------------------
// Weather icon
// -----------------------------------------------------------

export function getWeatherInfo(condition = '') {
  const text = String(condition || '').toLowerCase();
  if (text.includes('hujan lebat') || text.includes('thunderstorm')) {
    return { label: 'Hujan Lebat', icon: 'fas fa-cloud-bolt', isRain: true };
  }
  if (text.includes('hujan sedang')) {
    return { label: 'Hujan Sedang', icon: 'fas fa-cloud-showers-heavy', isRain: true };
  }
  if (text.includes('hujan ringan') || text.includes('hujan') || text.includes('shower')) {
    return { label: 'Hujan Ringan', icon: 'fas fa-cloud-rain', isRain: true };
  }
  if (text.includes('berawan tebal')) {
    return { label: 'Berawan Tebal', icon: 'fas fa-cloud', isRain: false };
  }
  if (text.includes('cerah berawan')) {
    return { label: 'Cerah Berawan', icon: 'fas fa-cloud-sun', isRain: false };
  }
  if (text.includes('cerah')) {
    return { label: 'Cerah', icon: 'fas fa-sun', isRain: false };
  }
  if (text.includes('berawan')) {
    return { label: 'Berawan', icon: 'fas fa-cloud', isRain: false };
  }
  return { label: condition || 'Tidak diketahui', icon: 'fas fa-circle-question', isRain: false };
}

// -----------------------------------------------------------
// Farm-level aggregation (dari summary endpoint)
// -----------------------------------------------------------

/**
 * Ambil timestamp update paling baru dari farm + readings semua node.
 * Return Date | null.
 */
export function getFarmLastUpdate(farm, nodeSummaries = []) {
  const candidates = [];
  if (farm?.updated_at) candidates.push(farm.updated_at);
  for (const ns of nodeSummaries) {
    if (ns.node?.updated_at) candidates.push(ns.node.updated_at);
    if (ns.latest_reading?.created_at) candidates.push(ns.latest_reading.created_at);
  }
  if (!candidates.length) return null;
  return candidates.reduce((latest, current) => {
    const a = new Date(current).getTime();
    const b = new Date(latest).getTime();
    if (!Number.isFinite(a)) return latest;
    if (!Number.isFinite(b)) return current;
    return a > b ? current : latest;
  }, candidates[0]);
}

/**
 * Format luas lahan jadi string display. 0.5 → "0.5 ha", null → "—".
 */
export function formatAreaHa(areaHa) {
  if (areaHa == null || areaHa === '') return '—';
  return `${areaHa} ha`;
}

/**
 * Valve label dari decision.valve_state ('open' | 'closed' | undefined).
 */
export function valveLabelFromDecision(decision) {
  if (!decision) return 'Tidak diketahui';
  return decision.valve_state === 'open' ? 'Terbuka' : 'Tertutup';
}
