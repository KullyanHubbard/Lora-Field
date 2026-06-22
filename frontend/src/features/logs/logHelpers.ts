// Domain logic LogsPage — diport dari frontend React lama (pages/LogsPage.jsx)
// (FILTER_OPTIONS, classifyLog, getDecisionBadgeClass, formatLogTime, escapeCSV,
// dan pembentukan string CSV di handleExportCSV). Semua fungsi murni.
import type { IrrigationLog } from '@/types';
import type { StatusTone } from '@/lib/status';

export const LOG_FILTER_OPTIONS = [
  { key: 'all', label: 'logFilter.all' },
  { key: 'open', label: 'logFilter.open' },
  { key: 'delayed', label: 'logFilter.delayed' },
  { key: 'closed', label: 'logFilter.closed' },
  { key: 'warning', label: 'logFilter.warning' },
] as const;

export const LOG_TYPE_LABEL: Record<LogType, string> = {
  open: 'logClass.open',
  delayed: 'logClass.delayed',
  closed: 'logClass.closed',
  normal: 'logClass.normal',
};

export type LogFilterKey = (typeof LOG_FILTER_OPTIONS)[number]['key'];

export type LogType = 'open' | 'delayed' | 'closed' | 'normal';

export function classifyLog(log: Pick<IrrigationLog, 'decision' | 'valve_state'>): LogType {
  const decision = String(log.decision || '').toLowerCase();
  if (log.valve_state === 'open') return 'open';
  if (decision.includes('ditunda')) return 'delayed';
  if (log.valve_state === 'closed' && decision.includes('berhenti')) return 'closed';
  return 'normal';
}

// Versi lama: getDecisionBadgeClass -> 'badge-green' dst. Sekarang return tone.
export function getDecisionTone(type: LogType | 'warning'): StatusTone {
  switch (type) {
    case 'open':
      return 'green';
    case 'delayed':
      return 'yellow';
    case 'closed':
      return 'yellow';
    case 'warning':
      return 'red';
    default:
      return 'green';
  }
}

export function formatLogTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return String(iso);
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// -----------------------------------------------------------
// CSV export (bagian murni saja — pembentukan string. Side effect download
// Blob/anchor TIDAK diekstrak, tetap di komponen LogsPage.)
// -----------------------------------------------------------

const CSV_HEADERS = [
  'Waktu',
  'Node',
  'Lokasi',
  'Kelembapan (%)',
  'Threshold',
  'Cuaca',
  'Keputusan',
  'Valve',
  'Keterangan',
];

export interface LogCsvRow {
  time: string;
  nodeName: string;
  nodeLocation: string;
  soilMoisture: number | string;
  weather: string;
  decision: string;
  valveLabel: string;
  reason: string;
}

export function escapeCsv(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function buildLogsCsv(rows: LogCsvRow[], threshold: string): string {
  const headerLine = CSV_HEADERS.map(escapeCsv).join(',');
  const dataLines = rows.map((row) =>
    [
      row.time,
      row.nodeName,
      row.nodeLocation,
      row.soilMoisture,
      threshold,
      row.weather || '—',
      row.decision,
      row.valveLabel,
      row.reason || '—',
    ]
      .map(escapeCsv)
      .join(','),
  );
  return [headerLine, ...dataLines].join('\r\n');
}
