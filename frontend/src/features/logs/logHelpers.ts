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
] as const;

export const LOG_TYPE_LABEL: Record<LogType, string> = {
  open: 'logClass.open',
  delayed: 'logClass.delayed',
  closed: 'logClass.closed',
  normal: 'logClass.normal',
};

export type LogFilterKey = (typeof LOG_FILTER_OPTIONS)[number]['key'];

export type LogType = 'open' | 'delayed' | 'closed' | 'normal';

// Dari decision_type backend. Aksi manual ikut kelompok buka/tutup valve-nya.
// Standby dan log lama tanpa type dianggap normal.
export function classifyLog(log: Pick<IrrigationLog, 'decision_type'>): LogType {
  switch (log.decision_type) {
    case 'open':
    case 'manual_open':
      return 'open';
    case 'delayed':
      return 'delayed';
    case 'closed':
    case 'manual_closed':
    case 'manual_timeout':
      return 'closed';
    default:
      return 'normal';
  }
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
