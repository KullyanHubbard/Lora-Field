import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useFarmSummary } from '@/features/dashboard/queries';
import { useLogs } from '@/features/logs/queries';
import {
  buildLogsCsv,
  classifyLog,
  formatLogTime,
  type LogCsvRow,
  type LogFilterKey,
  type LogType,
} from '@/features/logs/logHelpers';
import type { IrrigationLog } from '@/types';

export interface ScopedLog extends IrrigationLog {
  time: string;
  type: LogType;
  nodeName: string;
  nodeLocation: string;
  valveLabel: string;
}

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

export function useLogsViewModel() {
  const { id: routeFarmId } = useParams();
  const { t } = useTranslation();
  const farmId = routeFarmId ?? '';

  const summaryQuery = useFarmSummary(farmId);
  const summary = summaryQuery.data;
  const nodes = useMemo(() => summary?.nodes ?? [], [summary?.nodes]);
  const logsQuery = useLogs(summary ? farmId : undefined, 100);

  const [activeFilter, setActiveFilter] = useState<LogFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const logs = useMemo(() => logsQuery.data?.items ?? [], [logsQuery.data?.items]);

  const nodeLookup = useMemo(
    () =>
      new Map(
        nodes.map((ns) => [
          ns.node.id,
          { name: ns.node.name || ns.node.id, location: ns.node.location || '' },
        ]),
      ),
    [nodes],
  );

  const threshold = summary?.thresholds
    ? `${summary.thresholds.lower}%-${summary.thresholds.upper}%`
    : '—';

  const scopedLogs = useMemo<ScopedLog[]>(
    () =>
      logs
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
        }),
    [logs, nodeLookup, t],
  );

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return scopedLogs.filter((log) => {
      const matchesFilter = activeFilter === 'all' || log.type === activeFilter;
      const matchesSearch =
        !q ||
        log.nodeName.toLowerCase().includes(q) ||
        log.nodeLocation.toLowerCase().includes(q) ||
        String(log.decision || '')
          .toLowerCase()
          .includes(q);
      const logMs = log.created_at ? new Date(log.created_at).getTime() : null;
      const matchesFrom = fromMs == null || (logMs != null && logMs >= fromMs);
      const matchesTo = toMs == null || (logMs != null && logMs <= toMs);
      return matchesFilter && matchesSearch && matchesFrom && matchesTo;
    });
  }, [activeFilter, dateFrom, dateTo, scopedLogs, searchQuery]);

  const clearDateFilter = () => {
    setDateFrom('');
    setDateTo('');
  };

  const exportCsv = () => {
    if (!summary || filteredLogs.length === 0) return;

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

  const errorMessage = summaryQuery.error
    ? t('logs.errorLoad', { message: summaryQuery.error.message })
    : logsQuery.error
      ? t('logs.errorLoad', { message: logsQuery.error.message })
      : t('logs.noData');

  return {
    farmId,
    summary,
    isLoading: summaryQuery.isLoading || logsQuery.isLoading,
    hasError: Boolean(summaryQuery.error || logsQuery.error) || !summary,
    errorMessage,
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    clearDateFilter,
    logs,
    filteredLogs,
    threshold,
    exportCsv,
  };
}
