import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useFarmSummary } from '@/features/dashboard/queries';
import { logsLimit, useLogs } from '@/features/logs/queries';
import {
  buildLogsCsv,
  classifyLog,
  formatLogTime,
  LOG_TYPE_LABEL,
  toLogsRange,
  type LogCsvRow,
  type LogFilterKey,
  type LogType,
} from '@/features/logs/logHelpers';
import { EMPTY_VALUE, formatLocalDateTime, parseServerDate } from '@/lib/format';
import { getIrrigationReasonKey } from '@/lib/status';
import type { IrrigationLog } from '@/types';

export interface ScopedLog extends IrrigationLog {
  time: string;
  type: LogType;
  decisionLabel: string;
  reasonLabel: string;
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
  const { t, i18n } = useTranslation();
  const farmId = routeFarmId ?? '';

  const summaryQuery = useFarmSummary(farmId);
  const summary = summaryQuery.data;
  const nodes = useMemo(() => summary?.nodes ?? [], [summary?.nodes]);

  const [activeFilter, setActiveFilter] = useState<LogFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const range = useMemo(() => toLogsRange(dateFrom, dateTo), [dateFrom, dateTo]);
  const logsQuery = useLogs(summary ? farmId : undefined, range);

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
    : EMPTY_VALUE;

  const scopedLogs = useMemo<ScopedLog[]>(
    () =>
      logs
        .filter((log) => nodeLookup.has(log.node_id))
        .map((log) => {
          const node = nodeLookup.get(log.node_id);
          const type = classifyLog(log);
          const reasonKey = getIrrigationReasonKey(log.decision_type);
          return {
            ...log,
            time: formatLogTime(log.created_at, i18n.language),
            type,
            decisionLabel: t(LOG_TYPE_LABEL[type]),
            reasonLabel: reasonKey ? t(reasonKey) : log.reason,
            nodeName: node?.name || log.node_id,
            nodeLocation: node?.location || EMPTY_VALUE,
            valveLabel: log.valve_state === 'open' ? t('logs.valveOpen') : t('logs.valveClosed'),
          };
        }),
    [logs, nodeLookup, t, i18n.language],
  );

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return scopedLogs.filter((log) => {
      const matchesFilter = activeFilter === 'all' || log.type === activeFilter;
      const matchesSearch =
        !q ||
        log.nodeName.toLowerCase().includes(q) ||
        log.nodeLocation.toLowerCase().includes(q) ||
        log.decisionLabel.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, scopedLogs, searchQuery]);

  const truncatedAt = logs.length >= logsLimit(range) ? logsLimit(range) : null;

  const clearDateFilter = () => {
    setDateFrom('');
    setDateTo('');
  };

  const exportCsv = () => {
    if (!summary || filteredLogs.length === 0) return;

    const rows: LogCsvRow[] = filteredLogs.map((log) => {
      const created = parseServerDate(log.created_at);
      return {
        time: created ? formatLocalDateTime(created) : log.time,
        nodeName: log.nodeName,
        nodeLocation: log.nodeLocation,
        soilMoisture: log.soil_moisture,
        weather: log.weather,
        decision: log.decisionLabel,
        valveLabel: log.valveLabel,
        reason: log.reasonLabel,
      };
    });
    const csv = buildLogsCsv(rows, threshold, t);
    const farmName = summary.farm.name || farmId || 'kebun';
    const today = formatLocalDateTime(new Date()).slice(0, 10);
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
    truncatedAt,
    threshold,
    exportCsv,
  };
}
