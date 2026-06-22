// Status/badge mappers murni — diport dari frontend React lama (utils/farmHelpers.js:
// getGatewayStatusBadge, getNodeStatusBadge, getValveStatusBadge,
// getIrrigationStatusBadge, getSoilStatusFromMoisture) dan dari logika gauge di
// pages/FarmDetailPage.jsx (SoilGauge).
//
// Catatan port: versi lama mengembalikan className CSS lama ('badge-green' dst).
// Di build baru fungsi ini mengembalikan `tone` semantik (green/yellow/red);
// pemetaan tone -> kelas/token tema dilakukan di lapisan UI (komponen Badge),
// bukan di sini. Perilaku keputusan (status -> warna) dipertahankan apa adanya.

export type StatusTone = 'green' | 'yellow' | 'red';

export interface StatusBadge {
  label: string;
  tone: StatusTone;
}

export function getGatewayStatusBadge(status: string): StatusBadge {
  const map: Record<string, StatusBadge> = {
    online: { label: 'Online', tone: 'green' },
    offline: { label: 'Offline', tone: 'red' },
    degraded: { label: 'Gangguan', tone: 'yellow' },
  };
  return map[status] ?? map.offline;
}

export function getNodeStatusBadge(status: string): StatusBadge {
  const map: Record<string, StatusBadge> = {
    online: { label: 'Online', tone: 'green' },
    standby: { label: 'Standby', tone: 'yellow' },
    offline: { label: 'Offline', tone: 'red' },
  };
  return map[status] ?? map.offline;
}

export function getValveStatusBadge(valveLabel: string): StatusBadge {
  const map: Record<string, StatusBadge> = {
    Terbuka: { label: 'Terbuka', tone: 'green' },
    Tertutup: { label: 'Tertutup', tone: 'yellow' },
    'Tidak diketahui': { label: 'Tidak diketahui', tone: 'red' },
  };
  return map[valveLabel] ?? map['Tidak diketahui'];
}

export function getIrrigationStatusBadge(label: string): StatusBadge {
  if (label === 'Aktif' || label === 'Irigasi aktif' || label === 'Normal') {
    return { label, tone: 'green' };
  }
  if (label === 'Perlu cek gateway') {
    return { label, tone: 'red' };
  }
  return { label: label || 'Perlu cek', tone: 'yellow' };
}

export function getSoilStatusFromMoisture(
  value: number | null | undefined,
  lower = 40,
  upper = 70,
): StatusBadge {
  if (value == null || value <= 0) {
    return { label: 'Tidak Ada Data', tone: 'red' };
  }
  if (value < lower) return { label: 'Butuh Irigasi', tone: 'red' };
  if (value > upper) return { label: 'Terlalu Basah', tone: 'yellow' };
  return { label: 'Normal', tone: 'green' };
}

// Gauge tanah: state semantik dari nilai kelembapan. Versi lama meng-hardcode hex
// (value<lower -> #ef4444, value>upper -> #3b82f6, normal -> #10b981, no-data ->
// abu). Di build baru kembalikan state; SoilGauge memetakan state -> token tema.
export type SoilGaugeState = 'no-data' | 'dry' | 'wet' | 'normal';

export function getSoilGaugeState(
  value: number | null | undefined,
  lower = 40,
  upper = 70,
): SoilGaugeState {
  if (value == null || value <= 0) return 'no-data';
  if (value < lower) return 'dry';
  if (value > upper) return 'wet';
  return 'normal';
}
