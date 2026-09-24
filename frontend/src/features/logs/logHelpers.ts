// Domain logic LogsPage: diport dari frontend React lama (pages/LogsPage.jsx)
// (FILTER_OPTIONS, classifyLog, getDecisionBadgeClass, formatLogTime, escapeCSV,
// dan pembentukan string CSV di handleExportCSV). Semua fungsi murni.
import type { TFunction } from 'i18next';
import type { IrrigationLog } from '@/types';
import type { StatusTone } from '@/lib/status';
import { EMPTY_VALUE, formatClockTime, parseServerDate } from '@/lib/format';

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
  warning: 'logClass.warning',
  normal: 'logClass.normal',
};

export type LogFilterKey = (typeof LOG_FILTER_OPTIONS)[number]['key'];

export type LogType = 'open' | 'delayed' | 'closed' | 'warning' | 'normal';

export function classifyLog(log: Pick<IrrigationLog, 'decision' | 'valve_state'>): LogType {
  const decision = String(log.decision || '').toLowerCase();
  if (
    decision.includes('reconnect') ||
    decision.includes('delay') ||
    decision.includes('anomali') ||
    decision.includes('peringatan')
  ) {
    return 'warning';
  }
  if (log.valve_state === 'open') return 'open';
  if (decision.includes('ditunda')) return 'delayed';
  if (log.valve_state === 'closed' && decision.includes('berhenti')) return 'closed';
  return 'normal';
}

// Versi lama: getDecisionBadgeClass -> 'badge-green' dst. Sekarang return tone.
export function getDecisionTone(type: LogType): StatusTone {
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

export function formatLogTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return EMPTY_VALUE;
  const d = parseServerDate(iso);
  return d ? formatClockTime(d, locale, true) : String(iso);
}

// -----------------------------------------------------------
// CSV export (bagian murni saja, pembentukan string. Side effect download
// Blob/anchor TIDAK diekstrak, tetap di komponen LogsPage.)
// -----------------------------------------------------------

// Header CSV = judul kolom tabel Riwayat, ikut bahasa aplikasi.
function csvHeaders(t: TFunction): string[] {
  return [
    t('logs.colTime'),
    t('logs.colNode'),
    t('logs.colLocation'),
    `${t('logs.colMoisture')} (%)`,
    t('logs.colThreshold'),
    t('logs.colWeather'),
    t('logs.colDecision'),
    t('logs.colValve'),
    t('logs.colReason'),
  ];
}

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

function escapeCsv(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function buildLogsCsv(rows: LogCsvRow[], threshold: string, t: TFunction): string {
  const headerLine = csvHeaders(t).map(escapeCsv).join(',');
  const dataLines = rows.map((row) =>
    [
      row.time,
      row.nodeName,
      row.nodeLocation,
      row.soilMoisture,
      threshold,
      row.weather || EMPTY_VALUE,
      row.decision,
      row.valveLabel,
      row.reason || EMPTY_VALUE,
    ]
      .map(escapeCsv)
      .join(','),
  );
  return [headerLine, ...dataLines].join('\r\n');
}
