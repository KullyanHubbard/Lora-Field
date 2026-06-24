import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, Search } from 'lucide-react';
import { useFarmSummary } from '@/features/farms/queries';
import { useLogs } from './queries';
import {
  buildLogsCsv,
  classifyLog,
  formatLogTime,
  getDecisionTone,
  LOG_FILTER_OPTIONS,
  LOG_TYPE_LABEL,
  type LogCsvRow,
  type LogFilterKey,
  type LogType,
} from './logHelpers';
import { StatusPill } from '@/components/ui/status-pill';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { IrrigationLog } from '@/types';

interface ScopedLog extends IrrigationLog {
  time: string;
  type: LogType;
  nodeName: string;
  nodeLocation: string;
  valveLabel: string;
}

// Side-effect download (Blob/anchor/BOM) tetap di komponen, bukan di helper.
function downloadCsv(filename: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function LogsPage() {
  const { t } = useTranslation();
  const { id: farmId } = useParams();
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useFarmSummary(
    farmId ?? '',
  );
  const { data: logsData, isLoading: logsLoading, error: logsError } = useLogs(farmId);

  const [activeFilter, setActiveFilter] = useState<LogFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Filter tanggal client-side. Backend GET /api/logs tidak punya param tanggal.
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  if (summaryLoading || logsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (summaryError || logsError || !summary) {
    const message = summaryError?.message ?? logsError?.message;
    return (
      <div className="space-y-3">
        <p className="text-destructive">
          {message ? t('logs.errorLoad', { message }) : t('logs.noData')}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">{t('logs.backToDashboard')}</Link>
        </Button>
      </div>
    );
  }

  const nodeLookup = new Map(
    summary.nodes.map((ns) => [
      ns.node.id,
      { name: ns.node.name || ns.node.id, location: ns.node.location || '' },
    ]),
  );
  const threshold = summary.thresholds
    ? `${summary.thresholds.lower}%-${summary.thresholds.upper}%`
    : '—';

  // Node bermasalah = node offline (client-side dari summary, tanpa endpoint baru).
  const offlineNodes = summary.nodes.filter((ns) => ns.node.status === 'offline');

  const logs = logsData?.items ?? [];
  const isMockLogs = logsData?.items === undefined ? false : logs.every((l) => l.id.startsWith('mock-log-'));
  const scopedLogs: ScopedLog[] = logs
    .filter((log) => nodeLookup.has(log.node_id))
    .map((log) => {
      const node = nodeLookup.get(log.node_id);
      return {
        ...log,
        time: formatLogTime(log.created_at),
        type: classifyLog(log),
        nodeName: node?.name || log.node_id,
        nodeLocation: node?.location || '—',
        valveLabel: log.valve_state === 'open' ? t('logs.valveOpen') : t('logs.valveClosed'),
      };
    });

  const q = searchQuery.trim().toLowerCase();
  // dateFrom/dateTo: string "YYYY-MM-DD" dari input date. Bandingkan dengan ISO string log.created_at.
  const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
  // dateTo: inklusif sampai akhir hari (23:59:59.999)
  const toMs = dateTo ? new Date(dateTo + 'T23:59:59.999').getTime() : null;

  const filteredLogs = scopedLogs.filter((log) => {
    const matchesFilter = activeFilter === 'all' || log.type === activeFilter;
    const matchesSearch =
      !q ||
      log.nodeName.toLowerCase().includes(q) ||
      log.nodeLocation.toLowerCase().includes(q) ||
      String(log.decision || '').toLowerCase().includes(q);
    const logMs = log.created_at ? new Date(log.created_at).getTime() : null;
    const matchesFrom = fromMs == null || (logMs != null && logMs >= fromMs);
    const matchesTo = toMs == null || (logMs != null && logMs <= toMs);
    return matchesFilter && matchesSearch && matchesFrom && matchesTo;
  });

  const handleExportCsv = () => {
    const rows: LogCsvRow[] = filteredLogs.map((log) => ({
      time: log.created_at || log.time,
      nodeName: log.nodeName,
      nodeLocation: log.nodeLocation,
      soilMoisture: log.soil_moisture,
      weather: log.weather,
      decision: log.decision,
      valveLabel: log.valveLabel,
      reason: log.reason,
    }));
    const csv = buildLogsCsv(rows, threshold);
    const farmName = summary.farm.name || farmId || 'kebun';
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`lorafield-logs-${farmName}-${today}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3">
          {/* E2: konteks kebun aktif — nama kebun di heading, tanpa dropdown lintas-kebun */}
          <p className="text-sm font-medium text-foreground">
            {t('logs.farmContext', { name: summary.farm.name || farmId || '—' })}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter log">
                {LOG_FILTER_OPTIONS.map((opt) => (
                  <Button
                    key={opt.key}
                    type="button"
                    size="sm"
                    variant={activeFilter === opt.key ? 'default' : 'outline'}
                    aria-pressed={activeFilter === opt.key}
                    onClick={() => setActiveFilter(opt.key)}
                  >
                    {t(opt.label)}
                  </Button>
                ))}
              </div>
              {isMockLogs && <StatusPill tone="yellow" label="Data Contoh" />}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t('logs.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-8"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleExportCsv}
                disabled={!filteredLogs.length}
              >
                <Download className="size-4" /> {t('logs.exportCsv')}
              </Button>
            </div>
          </div>

          {/* E1: filter tanggal client-side */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">{t('logs.dateFilterLabel')}:</span>
            <div className="flex items-center gap-1.5">
              <label htmlFor="log-date-from" className="text-sm text-muted-foreground">
                {t('logs.dateFrom')}
              </label>
              <Input
                id="log-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36 text-sm"
                max={dateTo || undefined}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label htmlFor="log-date-to" className="text-sm text-muted-foreground">
                {t('logs.dateTo')}
              </label>
              <Input
                id="log-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36 text-sm"
                min={dateFrom || undefined}
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
              >
                ✕
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('logs.dateFilterNote', { count: logs.length })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{t('logs.problemTitle')}</span>
            {offlineNodes.length > 0 ? (
              <StatusPill
                tone="red"
                label={t('logs.problemCount', { count: offlineNodes.length })}
              />
            ) : (
              <StatusPill tone="green" label={t('logs.allActive')} />
            )}
          </div>
          {offlineNodes.length > 0 && (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {offlineNodes.map((ns) => (
                <li key={ns.node.id} className="flex items-center gap-2">
                  <span className="text-foreground">{ns.node.name || ns.node.id}</span>
                  <span aria-hidden="true">·</span>
                  <span>{ns.node.location || '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('logs.colTime')}</TableHead>
                <TableHead>{t('logs.colNode')}</TableHead>
                <TableHead>{t('logs.colLocation')}</TableHead>
                <TableHead>{t('logs.colMoisture')}</TableHead>
                <TableHead>{t('logs.colThreshold')}</TableHead>
                <TableHead>{t('logs.colWeather')}</TableHead>
                <TableHead>{t('logs.colDecision')}</TableHead>
                <TableHead>{t('logs.colValve')}</TableHead>
                <TableHead>{t('logs.colReason')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {t('logs.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="tabular-nums">{log.time}</TableCell>
                    <TableCell>{log.nodeName}</TableCell>
                    <TableCell className="text-muted-foreground">{log.nodeLocation}</TableCell>
                    <TableCell className="tabular-nums">{log.soil_moisture}%</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{threshold}</TableCell>
                    <TableCell className="text-muted-foreground">{log.weather || '—'}</TableCell>
                    <TableCell>
                      <StatusPill tone={getDecisionTone(log.type)} label={t(LOG_TYPE_LABEL[log.type])} />
                    </TableCell>
                    <TableCell>{log.valveLabel}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.reason || '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
