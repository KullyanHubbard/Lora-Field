// Status/badge mappers murni: diport dari frontend React lama (utils/farmStatusHelpers.js:
// getGatewayStatusBadge, getNodeStatusBadge, getValveStatusBadge,
// getIrrigationStatusBadge, getSoilStatusFromMoisture) dan dari logika gauge di
// pages/DashboardPage.jsx (SoilGauge).
//
// Catatan port: versi lama mengembalikan className CSS lama ('badge-green' dst).
// Di build baru fungsi ini mengembalikan `tone` semantik (green/yellow/red);
// pemetaan tone -> kelas/token tema dilakukan di lapisan UI (komponen Badge),
// bukan di sini. Perilaku keputusan (status -> warna) dipertahankan apa adanya.

import type { DecisionType, SemanticTone } from '@/types';

export type StatusTone = Exclude<SemanticTone, 'neutral'>;

interface StatusBadge {
  labelKey: string;
  tone: StatusTone;
}

export function getGatewayStatusBadge(status: string): StatusBadge {
  const map: Record<string, StatusBadge> = {
    online: { labelKey: 'status.online', tone: 'green' },
    offline: { labelKey: 'status.offline', tone: 'red' },
  };
  return map[status] ?? map.offline;
}

export function getNodeStatusBadge(status: string): StatusBadge {
  const map: Record<string, StatusBadge> = {
    online: { labelKey: 'status.online', tone: 'green' },
    offline: { labelKey: 'status.offline', tone: 'red' },
  };
  return map[status] ?? map.offline;
}

export function getValveStatusBadge(valveKey: string): StatusBadge {
  const map: Record<string, StatusBadge> = {
    'valve.open': { labelKey: 'valve.open', tone: 'green' },
    'valve.closed': { labelKey: 'valve.closed', tone: 'yellow' },
    'valve.unknown': { labelKey: 'valve.unknown', tone: 'red' },
  };
  return map[valveKey] ?? map['valve.unknown'];
}

// Dipetakan dari decision.type backend, bukan dari teks keputusannya.
export function getIrrigationStatusBadge(type: DecisionType): StatusBadge {
  const map: Record<DecisionType, StatusBadge> = {
    open: { labelKey: 'irrigationStatus.active', tone: 'green' },
    delayed: { labelKey: 'irrigationStatus.delayed', tone: 'yellow' },
    closed: { labelKey: 'irrigationStatus.closed', tone: 'yellow' },
    standby: { labelKey: 'irrigationStatus.normal', tone: 'green' },
    disconnected: { labelKey: 'irrigationStatus.disconnected', tone: 'red' },
    // Posisi valve sudah tampil di badge valve, jadi label cukup "Manual"; tone ikut posisi valve.
    manual_open: { labelKey: 'irrigationStatus.manual', tone: 'green' },
    manual_closed: { labelKey: 'irrigationStatus.manual', tone: 'yellow' },
    manual_timeout: { labelKey: 'irrigationStatus.manual', tone: 'yellow' },
    manual_saturated: { labelKey: 'irrigationStatus.saturated', tone: 'red' },
    soaking: { labelKey: 'irrigationStatus.soaking', tone: 'green' },
    pulse_limit: { labelKey: 'irrigationStatus.pulseLimit', tone: 'yellow' },
  };
  return map[type];
}

// Alasan keputusan dalam bahasa aplikasi. Teks backend dipakai untuk log lama tanpa type.
export function getIrrigationReasonKey(type: DecisionType | null | undefined): string | null {
  return type ? `irrigationReason.${type}` : null;
}

// lower/upper = threshold kebun dari summary.thresholds (ikut jenis tanaman).
export function getSoilStatusFromMoisture(
  value: number | null | undefined,
  lower: number,
  upper: number,
): StatusBadge {
  if (value == null || value <= 0) {
    return { labelKey: 'soilStatus.noData', tone: 'red' };
  }
  if (value < lower) return { labelKey: 'soilStatus.dry', tone: 'red' };
  if (value > upper) return { labelKey: 'soilStatus.wet', tone: 'yellow' };
  return { labelKey: 'soilStatus.normal', tone: 'green' };
}

// Batas baterai: di bawah LOW merah, sampai MID kuning, di atasnya hijau.
export const BATTERY_LOW_PCT = 20;
export const BATTERY_MID_PCT = 50;

export function batteryTone(value: number): StatusTone {
  if (value < BATTERY_LOW_PCT) return 'red';
  if (value <= BATTERY_MID_PCT) return 'yellow';
  return 'green';
}
