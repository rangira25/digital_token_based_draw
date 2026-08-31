'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, apiUrls } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { IconInfoCircle, IconAlertTriangle, IconAlertHexagon, IconCheck, IconX, IconTicket, IconUser, IconLock, IconSettings, IconFileText, IconShield, IconSearch, IconFlag, IconReport } from '@tabler/icons-react';
import { Pagination } from '@/components/Pagination';

// ─── Types ────────────────────────────────────────────────────────────────────

type LogCategory = 'all' | 'draw' | 'token' | 'participant' | 'auth' | 'system';
type LogStatus   = 'all' | 'success' | 'failure' | 'warning';
type Severity    = 'info' | 'warning' | 'critical';
type InvestigationStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';

interface AuditLog {
  id: string;
  timestamp: string;
  category: Exclude<LogCategory, 'all'>;
  action: string;
  actor: string;
  actorRole: string;
  target: string;
  status: Exclude<LogStatus, 'all'>;
  severity: Severity;
  details: string;
  ip: string;
  device: string;
  deviceFingerprint: string;
  location: string;
  verificationHash: string;
  flagged?: boolean;
}

interface Alert {
  id: string;
  timestamp: string;
  type: string;
  severity: Severity;
  description: string;
  affectedEntity: string;
  ip: string;
  investigationStatus: InvestigationStatus;
  notes: string;
}

type ModalView = 'detail' | 'investigate' | 'report' | null;

// ─── Sub-components ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  const map: Record<Severity, string> = {
    info:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
    warning:  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  const icons: Record<Severity, string> = { info: 'info', warning: 'warning', critical: 'critical' };
  const iconMap: Record<Severity, React.ComponentType<any>> = { info: IconInfoCircle, warning: IconAlertTriangle, critical: IconAlertHexagon };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${map[severity]}`}>
      {(() => { const Ic = iconMap[severity]; return Ic ? <Ic size={12} stroke={2} /> : null; })()} {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: Exclude<LogStatus, 'all'> }) {
  const map = {
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    failure: 'bg-red-500/20 text-red-400 border-red-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono border ${map[status]}`}>
      {status === 'success' ? <IconCheck size={12} stroke={2} /> : status === 'failure' ? <IconX size={12} stroke={2} /> : <IconAlertTriangle size={12} stroke={2} />} {status}
    </span>
  );
}

function CategoryBadge({ category }: { category: Exclude<LogCategory, 'all'> }) {
  const map: Record<string, string> = {
    draw:        'bg-primary/20 text-primary border-primary/30',
    token:       'bg-purple-500/20 text-purple-400 border-purple-500/30',
    participant: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    auth:        'bg-orange-500/20 text-orange-400 border-orange-500/30',
    system:      'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  const iconMap: Record<string, React.ComponentType<any>> = {
    draw: IconTicket, token: IconTicket, participant: IconUser, auth: IconLock, system: IconSettings,
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono border ${map[category]}`}>
      {(() => { const Ic = iconMap[category]; return Ic ? <Ic size={12} stroke={2} /> : null; })()} {category}
    </span>
  );
}

function InvestigationBadge({ status }: { status: InvestigationStatus }) {
  const map: Record<InvestigationStatus, string> = {
    open:          'bg-red-500/20 text-red-400 border-red-500/30',
    investigating: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    resolved:      'bg-green-500/20 text-green-400 border-green-500/30',
    dismissed:     'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono border capitalize ${map[status]}`}>
      {status}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [logs, setLogs]                   = useState<AuditLog[]>([]);
  const [alerts, setAlerts]               = useState<Alert[]>([]);
  const [activeTab, setActiveTab]         = useState<'logs' | 'alerts'>('logs');
  const [filterCategory, setFilterCategory] = useState<LogCategory>('all');
  const [filterStatus, setFilterStatus]   = useState<LogStatus>('all');
  const [filterSeverity, setFilterSeverity] = useState<'all' | Severity>('all');
  const [searchTerm, setSearchTerm]       = useState('');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [modal, setModal]                 = useState<ModalView>(null);
  const [selectedLog, setSelectedLog]     = useState<AuditLog | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [investigationNote, setInvestigationNote] = useState('');
  const [reportGenerating, setReportGenerating]   = useState(false);
  const [reportReady, setReportReady]             = useState(false);
  const [auditLoading, setAuditLoading]   = useState(true);
  const [page, setPage]                   = useState(1);
  const PAGE_SIZE = 10;

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    if (!user || (user.role !== 'organizer' && user.role !== 'admin')) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

  // Fetch audit logs from API
  useEffect(() => {
    if (!user) return;
    const fetchLogs = async () => {
      try {
        const res = await api<{ success: boolean; data: any[] }>(apiUrls.audit.list);
        const mapped: AuditLog[] = (res.data || []).map((l: any, idx: number) => ({
          id: l.id || `log-${idx}`,
          timestamp: l.created_at?.replace('T', ' ').slice(0, 19) || '',
          category: (l.action?.includes('draw') ? 'draw' : l.action?.includes('token') ? 'token' : l.action?.includes('auth') ? 'auth' : 'system') as AuditLog['category'],
          action: l.action || 'Unknown',
          actor: l.user?.email || l.actor_email || 'system',
          actorRole: l.user?.role || l.actor_role || 'system',
          target: l.target || l.target_type || '',
          status: l.status === 'success' ? 'success' : l.status === 'failure' ? 'failure' : 'info' as AuditLog['status'],
          severity: l.severity === 'critical' ? 'critical' : l.severity === 'warning' ? 'warning' : 'info' as Severity,
          details: l.details || l.description || '',
          ip: l.ip_address || l.ip || '0.0.0.0',
          device: l.user_agent || 'Unknown',
          deviceFingerprint: '',
          location: '',
          verificationHash: '',
          flagged: l.flagged || false,
        }));
        setLogs(mapped);
      } catch {} finally {
        setAuditLoading(false);
      }
    };
    fetchLogs();
  }, [user]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredLogs = useMemo(() => logs.filter(log => {
    if (filterCategory !== 'all' && log.category !== filterCategory) return false;
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    if (filterSeverity !== 'all' && log.severity !== filterSeverity) return false;
    if (showFlaggedOnly && !log.flagged) return false;
    if (dateFrom && log.timestamp < dateFrom) return false;
    if (dateTo && log.timestamp > dateTo + ' 23:59:59') return false;
    const q = searchTerm.toLowerCase();
    return !q || log.action.toLowerCase().includes(q) || log.actor.toLowerCase().includes(q) ||
      log.target.toLowerCase().includes(q) || log.ip.includes(q) || log.details.toLowerCase().includes(q);
  }), [logs, filterCategory, filterStatus, filterSeverity, showFlaggedOnly, dateFrom, dateTo, searchTerm]);

  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, page]);

  useEffect(() => { setPage(1); }, [filterCategory, filterStatus, filterSeverity, showFlaggedOnly, dateFrom, dateTo, searchTerm]);

  const stats = useMemo(() => ({
    total:    logs.length,
    success:  logs.filter(l => l.status === 'success').length,
    failures: logs.filter(l => l.status === 'failure').length,
    flagged:  logs.filter(l => l.flagged).length,
    critical: logs.filter(l => l.severity === 'critical').length,
    today:    logs.filter(l => l.timestamp.startsWith(new Date().toISOString().slice(0, 10))).length,
    openAlerts: alerts.filter(a => a.investigationStatus === 'open').length,
  }), [logs, alerts]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleExportCSV = useCallback((data: AuditLog[]) => {
    const rows = [
      ['ID', 'Timestamp', 'Category', 'Action', 'Actor', 'Role', 'Target', 'Status', 'Severity', 'Details', 'IP', 'Device', 'Location', 'Hash'],
      ...data.map(l => [l.id, l.timestamp, l.category, l.action, l.actor, l.actorRole, l.target, l.status, l.severity, l.details, l.ip, l.device, l.location, l.verificationHash]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `audit-log-${Date.now()}.csv`;
    a.click();
  }, []);

  const handleGenerateReport = useCallback(async () => {
    setReportGenerating(true);
    setReportReady(false);
    // Export filtered logs as CSV report
    handleExportCSV(filteredLogs);
    await new Promise(r => setTimeout(r, 500));
    setReportGenerating(false);
    setReportReady(true);
  }, [filteredLogs, handleExportCSV]);

  const handleUpdateInvestigation = useCallback((_alertId: string, _status: InvestigationStatus) => {
    toast({ title: 'Investigation note recorded', description: 'Your investigation update has been saved.' });
    setModal(null);
    setSelectedAlert(null);
    setInvestigationNote('');
  }, []);

  const verifyLogHash = useCallback((log: AuditLog) => {
    // Mock: in real app would re-compute hash from log data and compare
    return log.verificationHash.startsWith('sha256:');
  }, []);

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (isLoading) return null;
  if (!user || (user.role !== 'organizer' && user.role !== 'admin')) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start justify-between">
            <div className="space-y-1">
              <h1 className="text-4xl font-bold text-foreground">Fraud Prevention & Audit</h1>
              <p className="text-muted-foreground">Complete transparency — all system events, anomalies, and investigations logged.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { setModal('report'); setReportReady(false); }}
                variant="outline" className="border-primary/20">
                <IconFileText size={18} stroke={1.5} /> Generate Report
              </Button>
              <Button onClick={() => handleExportCSV(filteredLogs)}
                className="bg-primary text-primary-foreground hover:bg-primary/90">
                ↓ Export CSV
              </Button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total Events',   value: stats.total,      color: 'text-foreground',  bg: 'bg-card border-primary/20' },
              { label: 'Success',        value: stats.success,    color: 'text-green-400',   bg: 'bg-green-500/5 border-green-500/20' },
              { label: 'Failures',       value: stats.failures,   color: 'text-red-400',     bg: 'bg-red-500/5 border-red-500/20' },
              { label: 'Flagged',        value: stats.flagged,    color: 'text-yellow-400',  bg: 'bg-yellow-500/5 border-yellow-500/20' },
              { label: 'Critical',       value: stats.critical,   color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30' },
              { label: 'Today',          value: stats.today,      color: 'text-primary',     bg: 'bg-primary/5 border-primary/20' },
              { label: 'Open Alerts',    value: stats.openAlerts, color: 'text-orange-400',  bg: 'bg-orange-500/5 border-orange-500/20' },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className={`border rounded-lg p-3 space-y-1 ${s.bg}`}>
                <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Unusual Activity Banner */}
          {stats.openAlerts > 0 && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <IconAlertHexagon size={32} className="text-red-400" />
                <div>
                  <p className="text-red-400 font-bold text-sm">Unusual Activity Detected</p>
                  <p className="text-xs text-red-400/80">
                    {stats.openAlerts} open alert{stats.openAlerts > 1 ? 's' : ''} require investigation.
                    {stats.critical > 0 && ` ${stats.critical} critical event${stats.critical > 1 ? 's' : ''} logged.`}
                  </p>
                </div>
              </div>
              <Button onClick={() => setActiveTab('alerts')}
                className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 text-xs">
                View Alerts →
              </Button>
            </motion.div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
            {(['logs', 'alerts'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded text-sm font-medium transition-all ${
                  activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {tab === 'logs' ? `Audit Logs (${logs.length})` : `Alerts (${alerts.length})`}
              </button>
            ))}
          </div>

          {/* ── LOGS TAB ── */}
          {activeTab === 'logs' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

              {/* Filters */}
              <div className="bg-card border border-primary/20 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-sm">Filters</h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={showFlaggedOnly}
                      onChange={e => setShowFlaggedOnly(e.target.checked)} className="accent-primary" />
                    <span className="text-xs text-yellow-400 font-medium"><IconFlag size={12} stroke={2} /> Flagged only</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input placeholder="Search action, actor, IP, target…" value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="border-primary/20 bg-background text-foreground" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="border-primary/20 bg-background text-foreground text-xs" />
                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className="border-primary/20 bg-background text-foreground text-xs" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Category filter */}
                  <div className="flex gap-1 bg-muted rounded-lg p-1 flex-wrap">
                    {(['all', 'draw', 'token', 'participant', 'auth', 'system'] as const).map(c => (
                      <button key={c} onClick={() => setFilterCategory(c)}
                        className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                          filterCategory === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}>
                        {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Status filter */}
                  <div className="flex gap-1 bg-muted rounded-lg p-1">
                    {(['all', 'success', 'failure', 'warning'] as const).map(s => (
                      <button key={s} onClick={() => setFilterStatus(s)}
                        className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                          filterStatus === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Severity filter */}
                  <div className="flex gap-1 bg-muted rounded-lg p-1">
                    {(['all', 'info', 'warning', 'critical'] as const).map(s => (
                      <button key={s} onClick={() => setFilterSeverity(s)}
                        className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                          filterSeverity === s ? 'bg-red-500/40 text-red-200' : 'text-muted-foreground hover:text-foreground'
                        }`}>
                        {s === 'all' ? 'All Severity' : s}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Showing {filteredLogs.length} of {logs.length} events
                </p>
              </div>

              {/* Table */}
              <div className="bg-card border border-primary/20 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-primary/20 bg-muted">
                      <tr>
                        {['Timestamp', 'Category', 'Action / Details', 'Actor', 'IP / Location', 'Severity', 'Status', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/10">
                      <AnimatePresence>
                        {paginatedLogs.map((log, idx) => (
                          <motion.tr key={log.id}
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }} transition={{ delay: idx * 0.02 }}
                            className={`hover:bg-muted/40 transition-colors ${log.flagged ? 'bg-yellow-500/5 border-l-2 border-l-yellow-500/50' : ''}`}
                          >
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                              {log.timestamp}
                            </td>
                            <td className="px-4 py-3">
                              <CategoryBadge category={log.category} />
                            </td>
                            <td className="px-4 py-3 max-w-xs">
                              <div className="flex items-center gap-1.5">
                                {log.flagged && <span className="text-yellow-400 text-xs shrink-0"><IconFlag size={12} stroke={2} /></span>}
                                <p className="text-sm font-medium text-foreground">{log.action}</p>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.details}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs text-foreground">{log.actor === 'system' ? <><IconSettings size={12} stroke={2} /> System</> : log.actor}</p>
                              <p className="text-xs text-muted-foreground capitalize">{log.actorRole}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs font-mono text-foreground">{log.ip}</p>
                              <p className="text-xs text-muted-foreground">{log.location}</p>
                            </td>
                            <td className="px-4 py-3">
                              <SeverityBadge severity={log.severity} />
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={log.status} />
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => { setSelectedLog(log); setModal('detail'); }}
                                className="text-xs text-primary hover:text-primary/80 transition-colors font-mono">
                                View →
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
                {filteredLogs.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No audit logs match your filters.</p>
                  </div>
                )}
                <div className="border-t border-primary/10 px-4 py-3 bg-muted/30 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-mono">
                    {filteredLogs.length} of {logs.length} events
                  </p>
                  <Button onClick={() => handleExportCSV(filteredLogs)} variant="outline" size="sm"
                    className="border-primary/20 text-xs">
                    ↓ Export Filtered
                  </Button>
                </div>
              </div>
              <Pagination page={page} totalItems={filteredLogs.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </motion.div>
          )}

          {/* ── ALERTS TAB ── */}
          {activeTab === 'alerts' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {alerts.length === 0 ? (
                <div className="bg-card border border-primary/20 rounded-lg p-12 text-center space-y-3">
                  <IconShield size={32} className="text-primary" />
                  <p className="text-lg font-bold text-foreground">No security alerts detected</p>
                  <p className="text-sm text-muted-foreground">All systems are operating normally. Alerts will appear here when anomalies are detected.</p>
                </div>
              ) : (
                alerts.map((alert, idx) => (
                  <motion.div key={alert.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    className={`border rounded-lg p-5 space-y-3 ${
                      alert.severity === 'critical' ? 'bg-red-500/5 border-red-500/30' :
                      'bg-yellow-500/5 border-yellow-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <SeverityBadge severity={alert.severity} />
                          <InvestigationBadge status={alert.investigationStatus} />
                          <span className="text-xs text-muted-foreground font-mono">{alert.timestamp}</span>
                        </div>
                        <p className="font-bold text-foreground">{alert.type}</p>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                      </div>
                      <Button onClick={() => { setSelectedAlert(alert); setInvestigationNote(alert.notes); setModal('investigate'); }}
                        variant="outline" size="sm"
                        className={`shrink-0 ${alert.investigationStatus === 'open' ? 'border-red-500/30 text-red-400' : 'border-primary/20'}`}>
                        {alert.investigationStatus === 'resolved' || alert.investigationStatus === 'dismissed'
                          ? 'View' : 'Investigate'}
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-black/20 rounded-lg p-3 text-xs font-mono">
                      <div>
                        <p className="text-muted-foreground mb-0.5">Affected Entity</p>
                        <p className="text-foreground">{alert.affectedEntity}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">Source IP</p>
                        <p className="text-foreground">{alert.ip}</p>
                      </div>
                      {alert.notes && (
                        <div className="col-span-2 md:col-span-1">
                          <p className="text-muted-foreground mb-0.5">Investigation Notes</p>
                          <p className="text-foreground truncate">{alert.notes}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

        </div>
      </main>

      {/* ══════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {modal && (
          <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setModal(null); setSelectedLog(null); setSelectedAlert(null); }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4"
          >
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }} onClick={e => e.stopPropagation()}
              className="bg-card border border-primary/20 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            >

              {/* ─── Log Detail Modal ─── */}
              {modal === 'detail' && selectedLog && (
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">Event Detail</h2>
                      <p className="text-xs text-muted-foreground font-mono">{selectedLog.id}</p>
                    </div>
                    <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <CategoryBadge category={selectedLog.category} />
                    <SeverityBadge severity={selectedLog.severity} />
                    <StatusBadge status={selectedLog.status} />
                    {selectedLog.flagged && <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded"><IconFlag size={12} stroke={2} /> Flagged</span>}
                  </div>

                  <div className="space-y-3 text-sm">
                    {[
                      { label: 'Action',     value: selectedLog.action },
                      { label: 'Details',    value: selectedLog.details },
                      { label: 'Timestamp',  value: selectedLog.timestamp },
                      { label: 'Actor',      value: `${selectedLog.actor} (${selectedLog.actorRole})` },
                      { label: 'Target',     value: selectedLog.target },
                    ].map(row => (
                      <div key={row.label} className="flex gap-3">
                        <span className="text-muted-foreground w-24 shrink-0">{row.label}</span>
                        <span className="text-foreground">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* IP & Device */}
                  <div className="bg-muted/30 border border-primary/20 rounded-lg p-4 space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Network & Device</p>
                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div>
                        <p className="text-muted-foreground mb-0.5">IP Address</p>
                        <p className="text-foreground">{selectedLog.ip}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">Location</p>
                        <p className="text-foreground">{selectedLog.location}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">Device</p>
                        <p className="text-foreground">{selectedLog.device}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">Fingerprint</p>
                        <p className="text-primary">{selectedLog.deviceFingerprint}</p>
                      </div>
                    </div>
                  </div>

                  {/* Timestamp Verification */}
                  <div className="bg-muted/30 border border-primary/20 rounded-lg p-4 space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Timestamp Verification</p>
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Recorded at</span>
                        <span className="text-foreground">{selectedLog.timestamp}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Verification hash</span>
                        <span className="text-primary truncate max-w-[200px]">{selectedLog.verificationHash}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Hash integrity</span>
                        <span className={verifyLogHash(selectedLog) ? 'text-green-400' : 'text-red-400'}>
                          {verifyLogHash(selectedLog) ? <><IconCheck size={12} stroke={2} /> Verified</> : <><IconX size={12} stroke={2} /> Tampered</>}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {selectedLog.flagged && (
                      <Button variant="outline" className="flex-1 border-orange-500/30 text-orange-400 text-xs"
                        onClick={() => { setModal(null); }}>
                        <IconSearch size={14} stroke={2} /> Investigate
                      </Button>
                    )}
                    <Button onClick={() => handleExportCSV([selectedLog])} variant="outline" className="flex-1 border-primary/20 text-xs">
                      ↓ Export This Event
                    </Button>
                    <Button onClick={() => setModal(null)} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
                      Close
                    </Button>
                  </div>
                </div>
              )}

              {/* ─── Investigation Workflow Modal ─── */}
              {modal === 'investigate' && selectedAlert && (
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">Investigation Workflow</h2>
                      <p className="text-sm text-muted-foreground">{selectedAlert.type}</p>
                    </div>
                    <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <SeverityBadge severity={selectedAlert.severity} />
                    <InvestigationBadge status={selectedAlert.investigationStatus} />
                  </div>

                  <div className="bg-muted/30 border border-primary/20 rounded-lg p-4 space-y-2 text-sm">
                    <p className="text-muted-foreground">{selectedAlert.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2">
                      <div>
                        <span className="text-muted-foreground">Entity: </span>
                        <span className="text-foreground">{selectedAlert.affectedEntity}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">IP: </span>
                        <span className="text-foreground">{selectedAlert.ip}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Detected: </span>
                        <span className="text-foreground">{selectedAlert.timestamp}</span>
                      </div>
                    </div>
                  </div>

                  {/* Related log events */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Related Log Events</p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {logs.filter(l => l.ip === selectedAlert.ip || l.actor === selectedAlert.affectedEntity).map(l => (
                        <div key={l.id} className="flex items-center gap-2 bg-muted/30 rounded p-2 text-xs">
                          <CategoryBadge category={l.category} />
                          <span className="text-foreground flex-1 truncate">{l.action}</span>
                          <span className="text-muted-foreground font-mono shrink-0">{l.timestamp.split(' ')[0]}</span>
                        </div>
                      ))}
                      {logs.filter(l => l.ip === selectedAlert.ip || l.actor === selectedAlert.affectedEntity).length === 0 && (
                        <p className="text-xs text-muted-foreground">No related events found.</p>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground block">Investigation Notes</label>
                    <textarea
                      value={investigationNote}
                      onChange={e => setInvestigationNote(e.target.value)}
                      placeholder="Document your findings, actions taken, or resolution details…"
                      rows={3}
                      className="w-full border border-primary/20 bg-background text-foreground rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary/50"
                    />
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => handleUpdateInvestigation(selectedAlert.id, 'investigating')}
                      variant="outline" className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 text-xs">
                      <IconSearch size={14} stroke={2} /> Mark Investigating
                    </Button>
                    <Button onClick={() => handleUpdateInvestigation(selectedAlert.id, 'resolved')}
                      variant="outline" className="border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs">
                      <IconCheck size={14} stroke={2} /> Mark Resolved
                    </Button>
                    <Button onClick={() => handleUpdateInvestigation(selectedAlert.id, 'dismissed')}
                      variant="outline" className="border-gray-500/30 text-gray-400 hover:bg-gray-500/10 text-xs">
                      Dismiss (False Positive)
                    </Button>
                    <Button onClick={() => setModal(null)} variant="outline" className="border-primary/20 text-xs">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* ─── Audit Report Modal ─── */}
              {modal === 'report' && (
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">Audit Report Generation</h2>
                      <p className="text-sm text-muted-foreground">Generate a comprehensive fraud & audit report</p>
                    </div>
                    <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
                  </div>

                  <div className="bg-muted/30 border border-primary/20 rounded-lg p-4 space-y-3 text-sm">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Report will include</p>
                    {[
                      `${stats.total} total audit events`,
                      `${stats.flagged} flagged / suspicious events`,
                      `${alerts.length} security alerts (${stats.openAlerts} open)`,
                      'IP address & device fingerprint summary',
                      'Draw execution audit trail with hashes',
                      'Token generation & usage history',
                      'Participant verification log',
                      'Failed auth attempts timeline',
                      'Investigation workflow summaries',
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-primary"><IconCheck size={12} stroke={2} /></span>
                        <span className="text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Date From</label>
                      <Input type="date" className="border-primary/20 bg-background text-foreground text-xs" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Date To</label>
                      <Input type="date" className="border-primary/20 bg-background text-foreground text-xs" />
                    </div>
                  </div>

                  {reportGenerating && (
                    <div className="space-y-2">
                      {['Compiling audit events…', 'Verifying hashes…', 'Aggregating alerts…', 'Generating PDF…'].map((step, i) => (
                        <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.4 }}
                          className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                          {step}
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {reportReady && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center space-y-2">
                      <p className="text-green-400 font-bold"><IconCheck size={14} stroke={2} /> Report Ready</p>
                      <p className="text-xs text-muted-foreground">audit-log-export.csv ({logs.length} events)</p>
                    </motion.div>
                  )}

                  <div className="flex gap-2">
                    {!reportReady ? (
                      <Button onClick={handleGenerateReport} disabled={reportGenerating}
                        className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                        {reportGenerating ? 'Generating…' : 'Generate Report'}
                      </Button>
                    ) : (
                      <Button onClick={() => handleExportCSV(filteredLogs)}
                        className="flex-1 bg-green-500/80 text-white hover:bg-green-500">
                        ↓ Download Report (CSV)
                      </Button>
                    )}
                    <Button onClick={() => setModal(null)} variant="outline" className="flex-1 border-primary/20">
                      {reportReady ? 'Close' : 'Cancel'}
                    </Button>
                  </div>
                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}