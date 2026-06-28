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
    standby: { labelKey: 'status.standby', tone: 'yellow' },
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

// decision = raw backend string (e.g. "Irigasi dijalankan", "Irigasi ditunda").
// We classify by tone and return a stable labelKey for i18n display.
export function getIrrigationStatusBadge(decision: string): StatusBadge {
  const d = String(decision || '').toLowerCase();
  if (d.includes('dijalankan') || d.includes('aktif') || d === 'open') {
    return { labelKey: 'irrigationStatus.active', tone: 'green' };
  }
  if (d.includes('ditunda') || d.includes('delay')) {
    return { labelKey: 'irrigationStatus.delayed', tone: 'yellow' };
  }
  if (d.includes('berhenti') || d.includes('tutup') || d === 'closed') {
    return { labelKey: 'irrigationStatus.closed', tone: 'yellow' };
  }
  if (d.includes('normal')) {
    return { labelKey: 'irrigationStatus.normal', tone: 'green' };
  }
  return { labelKey: 'irrigationStatus.needsCheck', tone: 'yellow' };
}

export function getSoilStatusFromMoisture(
  value: number | null | undefined,
  lower = 40,
  upper = 70,
): StatusBadge {
  if (value == null || value <= 0) {
    return { labelKey: 'soilStatus.noData', tone: 'red' };
  }
  if (value < lower) return { labelKey: 'soilStatus.dry', tone: 'red' };
  if (value > upper) return { labelKey: 'soilStatus.wet', tone: 'yellow' };
  return { labelKey: 'soilStatus.normal', tone: 'green' };
}

export function batteryTone(value: number): StatusTone {
  if (value < 20) return 'red';
  if (value <= 50) return 'yellow';
  return 'green';
}
