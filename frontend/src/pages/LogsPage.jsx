import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../layout/DashboardLayout';
import { getFarmSummary, listLogs } from '../services/api';
import { setSelectedFarmId } from '../services/farms';

const FILTER_OPTIONS = [
  { key: 'all', label: 'Semua Log' },
  { key: 'open', label: 'Irigasi Dijalankan' },
  { key: 'delayed', label: 'Irigasi Ditunda' },
  { key: 'closed', label: 'Valve Tertutup' },
  { key: 'warning', label: 'Peringatan' },
];

function classifyLog(log) {
  const decision = String(log.decision || '').toLowerCase();
  if (log.valve_state === 'open') return 'open';
  if (decision.includes('ditunda')) return 'delayed';
  if (log.valve_state === 'closed' && decision.includes('berhenti')) return 'closed';
  return 'normal';
}

function getDecisionBadgeClass(type) {
  switch (type) {
    case 'open':
      return 'badge-green';
    case 'delayed':
      return 'badge-yellow';
    case 'closed':
      return 'badge-yellow';
    case 'warning':
      return 'badge-red';
    default:
      return 'badge-green';
  }
}

function formatLogTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return String(iso);
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function escapeCSV(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadCSV(filename, content) {
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

export function LogsPage() {
  const { id: farmId } = useParams();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    setError('');
    const [summaryRes, logsRes] = await Promise.all([
      getFarmSummary(farmId),
      listLogs(100),
    ]);
    setLoading(false);
    if (!summaryRes.ok) {
      if (summaryRes.status === 401) {
        signOut();
        navigate('/login', { replace: true });
        return;
      }
      if (summaryRes.status === 404) {
        setError('Kebun tidak ditemukan atau bukan milik akun Anda.');
        return;
      }
      setError(summaryRes.data.detail || `Gagal memuat data kebun (HTTP ${summaryRes.status}).`);
      return;
    }
    setSummary(summaryRes.data);
    if (summaryRes.data.farm?.id) setSelectedFarmId(summaryRes.data.farm.id);
    setLogs(logsRes.ok ? logsRes.data.items || [] : []);
  }, [farmId, navigate, signOut]);

  useEffect(() => {
    load();
  }, [load]);

  const nodeLookup = useMemo(() => {
    const map = new Map();
    for (const ns of summary?.nodes || []) {
      if (ns.node?.id) {
        map.set(ns.node.id, { name: ns.node.name || ns.node.id, location: ns.node.location || '' });
      }
    }
    return map;
  }, [summary]);

  const threshold = useMemo(() => {
    const t = summary?.thresholds;
    if (!t) return '—';
    return `${t.lower}%-${t.upper}%`;
  }, [summary]);

  const scopedLogs = useMemo(() => {
    if (!summary) return [];
    const farmNodeIds = new Set([...nodeLookup.keys()]);
    return logs
      .filter((log) => farmNodeIds.has(log.node_id))
      .map((log) => {
        const node = nodeLookup.get(log.node_id) || {};
        return {
          ...log,
          _time: formatLogTime(log.created_at),
          _type: classifyLog(log),
          _nodeName: node.name || log.node_id,
          _nodeLocation: node.location || '—',
          _valveLabel: log.valve_state === 'open' ? 'Terbuka' : 'Tertutup',
        };
      });
  }, [logs, nodeLookup, summary]);

  const filteredLogs = useMemo(() => {
    let result = scopedLogs;
    if (activeFilter !== 'all') {
      result = result.filter((log) => log._type === activeFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (log) =>
          log._nodeName.toLowerCase().includes(q) ||
          log._nodeLocation.toLowerCase().includes(q) ||
          String(log.decision || '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [scopedLogs, activeFilter, searchQuery]);

  const handleExportCSV = () => {
    const headers = [
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
    const rows = filteredLogs.map((log) =>
      [
        log.created_at || log._time,
        log._nodeName,
        log._nodeLocation,
        log.soil_moisture,
        threshold,
        log.weather || '—',
        log.decision,
        log._valveLabel,
        log.reason || '—',
      ]
        .map(escapeCSV)
        .join(','),
    );
    const csv = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
    const farmName = summary?.farm?.name || farmId;
    const today = new Date().toISOString().slice(0, 10);
    downloadCSV(`lorafield-logs-${farmName}-${today}.csv`, csv);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="empty-state">
          <i className="fas fa-spinner fa-spin" /> Memuat riwayat sistem...
        </div>
      </DashboardLayout>
    );
  }

  if (error || !summary) {
    return (
      <DashboardLayout>
        <div className="empty-state">
          {error || 'Data tidak tersedia.'}
          <div style={{ marginTop: 16 }}>
            <Link className="btn btn-primary btn-sm" to="/dashboard">
              Kembali ke Daftar Kebun
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="card mb-24">
        <div className="log-tools">
          <div className="filter-bar" role="group" aria-label="Filter log">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`filter-btn${activeFilter === opt.key ? ' active' : ''}`}
                aria-pressed={activeFilter === opt.key}
                onClick={() => setActiveFilter(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="log-right">
            <label className="search-box" htmlFor="log-search">
              <i className="fas fa-search" aria-hidden="true" />
              <input
                id="log-search"
                type="text"
                placeholder="Cari node, lokasi, atau keputusan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.trim())}
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExportCSV}
              disabled={!filteredLogs.length}
            >
              <i className="fas fa-download" aria-hidden="true" /> Ekspor CSV
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Node</th>
                <th>Lokasi</th>
                <th>Kelembapan</th>
                <th>Threshold</th>
                <th>Cuaca</th>
                <th>Keputusan</th>
                <th>Valve</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-table-cell">
                    Tidak ada log yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="data-value">{log._time}</td>
                    <td>{log._nodeName}</td>
                    <td>{log._nodeLocation}</td>
                    <td className="data-value">{log.soil_moisture}%</td>
                    <td className="data-value">{threshold}</td>
                    <td>{log.weather || '—'}</td>
                    <td>
                      <span className={`badge ${getDecisionBadgeClass(log._type)}`}>
                        {log.decision}
                      </span>
                    </td>
                    <td>{log._valveLabel}</td>
                    <td className="text-sm text-muted">{log.reason || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
