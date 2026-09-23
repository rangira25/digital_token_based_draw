'use client';
import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Pagination } from '@/components/Pagination';
import { api, apiUrls } from '@/lib/api';
import { exportExcel, exportPDF, type ExportColumn } from '@/lib/export';
import { IconSettings, IconArrowRight, IconX, IconStar, IconAlertTriangle, IconRefresh, IconShield, IconKey, IconUsers, IconClipboardList, IconAlertHexagon, IconCheck } from '@tabler/icons-react';
import { Sidebar } from '@/components/Navigation/Sidebar';

// -- Types -------------------------------------------------------------------

type Severity = 'critical' | 'high' | 'medium' | 'low';
type ActionKey = 'DRAW_CONFIG_CHANGE' | 'TOKEN_GENERATED' | 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'WINNER_SELECTED' | 'ANOMALY_FLAGGED' | 'PRIZE_CLAIM_MODIFIED' | 'ROLE_CHANGED';
type RoleKey = 'participant' | 'organizer' | 'admin';

interface AuditLog {
  id: string; ts: string; user: string; role: string;
  action: string; resource: string; detail: string;
  severity: Severity; ip: string;
}

interface Anomaly {
  id: string; ts: string; type: string; detail: string;
  severity: Severity; resolved: boolean;
}

interface RetentionItem {
  label: string; current: number; unit?: string; algo?: string;
}

// -- Helpers ------------------------------------------------------------------

const severityStyle: Record<Severity, { bg: string; border: string; text: string; dot: string; hex: string; borderLeft: string; shadow: string; glow: string }> = {
  critical: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-500", dot: "bg-red-500", hex: "#ff2d2d", borderLeft: "border-l-red-500", shadow: "shadow-[0_0_4px_#ff2d2d]", glow: "shadow-[0_0_6px_#ff2d2d]" },
  high:     { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-500", dot: "bg-orange-500", hex: "#ff7b00", borderLeft: "border-l-orange-500", shadow: "shadow-[0_0_4px_#ff7b00]", glow: "shadow-[0_0_6px_#ff7b00]" },
  medium:   { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-600", dot: "bg-yellow-500", hex: "#f5c200", borderLeft: "border-l-yellow-500", shadow: "shadow-[0_0_4px_#f5c200]", glow: "shadow-[0_0_6px_#f5c200]" },
  low:      { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-600", dot: "bg-green-500", hex: "#00c851", borderLeft: "border-l-green-500", shadow: "shadow-[0_0_4px_#00c851]", glow: "shadow-[0_0_6px_#00c851]" },
};

const actionIcon: Record<ActionKey, string> = {
  DRAW_CONFIG_CHANGE:   "settings",
  TOKEN_GENERATED:      "shield",
  LOGIN_SUCCESS:        "arrowRight",
  LOGIN_FAILED:         "x",
  WINNER_SELECTED:      "star",
  ANOMALY_FLAGGED:      "alertTriangle",
  PRIZE_CLAIM_MODIFIED: "refresh",
  ROLE_CHANGED:         "users",
};

const actionIconMap: Record<string, React.ComponentType<any>> = {
  settings: IconSettings, shield: IconShield, arrowRight: IconArrowRight, x: IconX,
  star: IconStar, alertTriangle: IconAlertTriangle, refresh: IconRefresh, users: IconUsers,
};

function getActionIcon(action: string): string {
  return (actionIcon as Record<string, string>)[action] ?? "\u00b7";
}

function getActionIconComponent(action: string): React.ComponentType<any> | null {
  const key = (actionIcon as Record<string, string>)[action];
  return key ? (actionIconMap[key] || null) : null;
}

function getSeverityStyle(severity: string) {
  return severityStyle[severity as Severity] ?? severityStyle.low;
}

// -- Sub-components -----------------------------------------------------------

function Tag({ severity }: { severity: string }) {
  const s = getSeverityStyle(severity);
  return (
    <span className={`${s.bg} ${s.border} ${s.text} border text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider`}>
      {severity}
    </span>
  );
}

function Check({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? "text-green-500 font-bold" : "text-red-400"}>
      {ok ? <IconCheck size={13} stroke={2} /> : <IconX size={13} stroke={2} />}
    </span>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="opacity-50">{icon}</span>
      <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-muted-foreground">{title}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// -- Main Component -----------------------------------------------------------

export default function SecurityAuditModule() {
  const [activeTab, setActiveTab]       = useState("audit");
  const [filterAction, setFilterAction] = useState("ALL");
  const [filterSeverity, setFilterSeverity] = useState("ALL");
  const [filterRole, setFilterRole]     = useState("ALL");
  const [search, setSearch]             = useState("");
  const [exportMsg, setExportMsg]       = useState("");
  const [auditLogs, setAuditLogs]       = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [anomalies, setAnomalies]       = useState<Anomaly[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [anomalyPage, setAnomalyPage] = useState(1);
  const ANOMALY_PAGE_SIZE = 5;
  const [encryptPage, setEncryptPage] = useState(1);
  const ENCRYPT_PAGE_SIZE = 5;
  const [retentionPage, setRetentionPage] = useState(1);
  const RETENTION_PAGE_SIZE = 5;
  const [permissions, setPermissions] = useState<Record<RoleKey, Record<string, boolean>> | null>(null);
  const [encryption, setEncryption] = useState<{ label: string; status: string; algo: string }[]>([]);
  const [retention, setRetention] = useState<RetentionItem[]>([]);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        const res = await api<{ success: boolean; data: any[] }>(apiUrls.audit.list);
        if (res.data?.length) {
          setAuditLogs(res.data.map((log: any) => ({
            id: log.id,
            ts: log.created_at ? log.created_at.replace('T', ' ').substring(0, 19) : '',
            user: log.actor_email || log.actor_name || '\u2014',
            role: log.actor_role || '\u2014',
            action: log.action || '',
            resource: log.entity_type || '',
            detail: log.description || '',
            severity: log.severity || 'info',
            ip: log.ip_address || '\u2014',
          })));
        }
      } catch {} finally {
        setAuditLoading(false);
      }
    };
    fetchAuditLogs();
  }, []);

  const tabs = [
    { id: "audit",     label: "Audit Log",        icon: "clipboardList" },
    { id: "anomaly",   label: "Anomaly Alerts",    icon: "alertTriangle" },
    { id: "timeline",  label: "Action Timeline",   icon: "clipboardList" },
    { id: "perms",     label: "Permission Matrix", icon: "users" },
    { id: "encrypt",   label: "Encryption Status", icon: "key" },
    { id: "retention", label: "Data Retention",    icon: "clipboardList" },
  ];

  const actions    = ["ALL", ...Array.from(new Set(auditLogs.map(l => l.action)))];
  const severities = ["ALL", "critical", "high", "medium", "low"];
  const roles      = ["ALL", "admin", "organizer", "\u2014", "system"];

  const filtered = useMemo(() => auditLogs.filter(l => {
    if (filterAction   !== "ALL" && l.action   !== filterAction)   return false;
    if (filterSeverity !== "ALL" && l.severity !== filterSeverity) return false;
    if (filterRole     !== "ALL" && l.role     !== filterRole)     return false;
    if (search && !JSON.stringify(l).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [filterAction, filterSeverity, filterRole, search, auditLogs]);

  useEffect(() => { setPage(1); }, [filterAction, filterSeverity, filterRole, search]);
  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  const paginatedAnomalies = useMemo(() => anomalies.slice((anomalyPage - 1) * ANOMALY_PAGE_SIZE, anomalyPage * ANOMALY_PAGE_SIZE), [anomalyPage, anomalies]);
  const paginatedEncryption = useMemo(() => encryption.slice((encryptPage - 1) * ENCRYPT_PAGE_SIZE, encryptPage * ENCRYPT_PAGE_SIZE), [encryptPage, encryption]);
  const paginatedRetention = useMemo(() => retention.slice((retentionPage - 1) * RETENTION_PAGE_SIZE, retentionPage * RETENTION_PAGE_SIZE), [retentionPage, retention]);

  const byDate = useMemo(() => {
    const groups: Record<string, AuditLog[]> = {};
    auditLogs.forEach(l => {
      const d = l.ts.split(" ")[0];
      if (!groups[d]) groups[d] = [];
      groups[d].push(l);
    });
    return groups;
  }, [auditLogs]);

  const AUDIT_EXPORT_COLUMNS: ExportColumn[] = [
    { header: 'ID', key: 'id' },
    { header: 'Timestamp', key: 'ts' },
    { header: 'User', key: 'user' },
    { header: 'Role', key: 'role' },
    { header: 'Action', key: 'action' },
    { header: 'Resource', key: 'resource' },
    { header: 'Detail', key: 'detail' },
    { header: 'Severity', key: 'severity' },
    { header: 'IP', key: 'ip' },
  ];

  const handleExport = (fmt: string) => {
    if (fmt === "PDF") {
      exportPDF({
        filename: 'audit-trail',
        title: 'Security & Audit Trail',
        subtitle: `${filtered.length} records`,
        columns: AUDIT_EXPORT_COLUMNS,
        data: filtered,
      });
    } else if (fmt === "Excel") {
      exportExcel(filtered, AUDIT_EXPORT_COLUMNS, 'audit-trail', 'Audit Trail');
    } else if (fmt === "JSON") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" }));
      a.download = "audit-trail.json";
      a.click();
    }
    setExportMsg(`Exported ${filtered.length} records as ${fmt}`);
    setTimeout(() => setExportMsg(""), 3000);
  };

  return (
    <>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-64 overflow-y-auto">
          <div className="p-8 font-sans">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6 mb-7">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 w-40 h-40 rounded-full bg-primary/5 blur-2xl" />
          </div>
          <div className="relative flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] text-primary tracking-widest uppercase mb-2">
                <IconShield size={14} stroke={2} /> System Module / Security
              </div>
              <h1 className="font-mono text-2xl font-bold text-foreground tracking-tight">
                Security &amp; Audit
              </h1>
              <p className="text-xs text-muted-foreground mt-1">Immutable audit trail, anomaly detection &amp; access control.</p>
            </div>
            <div className="flex gap-6">
              {[
                { label: "Critical Alerts", val: anomalies.filter(a => a.severity === "critical" && !a.resolved).length, colorClass: "text-red-500" },
                { label: "Open Anomalies",  val: anomalies.filter(a => !a.resolved).length,                  colorClass: "text-amber-500" },
                { label: "Log Entries",     val: auditLogs.length,                                                      colorClass: "text-primary" },
              ].map(s => (
                <div key={s.label} className="text-right">
                  <div className={`font-mono text-2xl font-bold ${s.colorClass}`}>{s.val}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-0.5 mb-6 border-b border-border">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-mono tracking-wider rounded-t -mb-px transition-all cursor-pointer active:scale-95 ${
              activeTab === t.id
                ? "bg-muted border border-border border-b-muted text-foreground"
                : "bg-transparent border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}>
              <span className="opacity-70">{(() => { const Ic = actionIconMap[t.icon]; return Ic ? <Ic size={14} stroke={1.5} /> : null; })()}</span>{t.label}
            </button>
          ))}
        </div>

        {/* -- AUDIT LOG ---------------------------------------------------- */}
        {activeTab === "audit" && (
          <div>
            <div className="flex gap-2.5 mb-4 flex-wrap items-center">
              <input placeholder="Search logs\u2026" value={search} onChange={e => setSearch(e.target.value)} className="w-[200px] bg-muted border border-border text-foreground font-mono text-xs px-3 py-2 rounded outline-none focus:border-primary" />
              <select value={filterAction}   onChange={e => setFilterAction(e.target.value)} className="bg-muted border border-border text-foreground font-mono text-xs px-3 py-2 rounded outline-none focus:border-primary">
                {actions.map(a    => <option key={a}>{a}</option>)}
              </select>
              <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="bg-muted border border-border text-foreground font-mono text-xs px-3 py-2 rounded outline-none focus:border-primary">
                {severities.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={filterRole}     onChange={e => setFilterRole(e.target.value)} className="bg-muted border border-border text-foreground font-mono text-xs px-3 py-2 rounded outline-none focus:border-primary">
                {roles.map(r      => <option key={r}>{r}</option>)}
              </select>
              <div className="flex-1" />
              {["Excel", "PDF", "JSON"].map(fmt => (
                <button key={fmt} onClick={() => handleExport(fmt)} className="bg-[#3BB82E]/10 border border-[#3BB82E]/30 text-[#288C1D] hover:bg-[#3BB82E]/20 hover:border-[#3BB82E]/50 px-3 py-1.5 text-[10px] font-mono tracking-widest rounded cursor-pointer transition-all active:scale-95 flex items-center gap-1">
                  &#8595; {fmt}
                </button>
              ))}
            </div>

            {exportMsg && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-500 px-3.5 py-2 rounded text-xs font-mono mb-3">
                <IconCheck size={14} stroke={2} /> {exportMsg}
              </div>
            )}

            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              {auditLoading ? (
                <div className="p-12 text-center">
                  <div className="font-mono text-sm text-muted-foreground opacity-70">Loading audit logs\u2026</div>
                </div>
              ) : (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/60 border-b border-border text-primary/80">
                    {["Timestamp", "User", "Action", "Resource", "Detail", "Severity"].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-[10px] font-bold tracking-widest uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((l, i) => {
                    return (
                      <motion.tr key={l.id}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className={`border-b border-border ${i % 2 === 0 ? "bg-transparent" : "bg-primary/[0.05]"} hover:bg-primary/[0.08] transition-colors`}>
                        <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{l.ts}</td>
                        <td className="px-3 py-3 text-foreground">{l.user}</td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/5 border border-primary/10 text-primary text-[10px]">
                            <span className="opacity-80">{(() => { const Ic = getActionIconComponent(l.action); return Ic ? <Ic size={13} stroke={1.5} /> : null; })()}</span>
                            {l.action}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-foreground">{l.resource}</td>
                        <td className="px-3 py-3 text-muted-foreground max-w-[240px] truncate">{l.detail}</td>
                        <td className="px-3 py-3"><Tag severity={l.severity} /></td>
                      </motion.tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground text-xs">No records match the current filters</td></tr>
                  )}
                </tbody>
              </table>
              )}
            </div>
            <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        )}

        {/* -- ANOMALY ALERTS ----------------------------------------------- */}
        {activeTab === "anomaly" && (
          <div className="max-w-[760px]">
            <SectionHeader icon={<IconAlertTriangle size={15} />} title="Real-time Anomaly Detection" />
            <div className="flex flex-col gap-2.5">
              {anomalies.length === 0 && (
                <div className="bg-card border border-border rounded px-4 py-8 text-center">
                  <IconAlertTriangle size={24} stroke={1.5} className="mx-auto mb-2 text-muted-foreground opacity-40" />
                  <p className="font-mono text-sm text-muted-foreground">No anomalies detected.</p>
                  <p className="text-[10px] text-muted-foreground opacity-60 mt-1">Anomaly data will appear here once the backend is configured.</p>
                </div>
              )}
              {paginatedAnomalies.map(a => {
                const s = getSeverityStyle(a.severity);
                return (
                  <div key={a.id} className={`rounded px-4 py-3.5 flex items-start gap-4 ${a.resolved ? "bg-card border border-border opacity-50" : `${s.bg} border ${s.border} ${s.shadow}`}`}>
                    <div className={`mt-[3px] w-2 h-2 rounded-full shrink-0 ${a.resolved ? "bg-muted-foreground" : `${s.dot} ${s.glow}`}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className={`text-sm font-semibold ${a.resolved ? "text-muted-foreground" : "text-foreground"}`}>{a.type}</span>
                        <Tag severity={a.severity} />
                        {a.resolved && <span className="text-[10px] text-muted-foreground bg-muted border border-border px-1.5 py-px rounded">resolved</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">{a.detail}</div>
                      <div className="text-[10px] text-muted-foreground opacity-60">{a.ts} \u00b7 {a.id}</div>
                    </div>
                    {!a.resolved && (
                      <button className={`border ${s.border} ${s.text} bg-transparent px-3 py-1 text-[10px] rounded shrink-0 cursor-pointer transition-colors hover:bg-primary/5 active:scale-95 active:bg-primary/10`}>
                        Investigate &rarr;
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <Pagination page={anomalyPage} totalItems={anomalies.length} pageSize={ANOMALY_PAGE_SIZE} onPageChange={setAnomalyPage} />

            <div className="mt-7">
              <SectionHeader icon={<IconShield size={15} />} title="Detection Thresholds" />
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { rule: "Token Generation Rate",  threshold: "> 20 req/min", severity: "critical" as Severity },
                  { rule: "Failed Login Attempts",   threshold: "\u2265 5 in 15 min", severity: "high" as Severity },
                  { rule: "Off-hours Config Change", threshold: "10 PM \u2013 6 AM", severity: "medium" as Severity },
                  { rule: "Prize Claim Modification",threshold: "Any change",   severity: "medium" as Severity },
                  { rule: "Role Escalation",         threshold: "Any change",   severity: "high" as Severity },
                  { rule: "Bulk Data Export",        threshold: "> 500 records",severity: "medium" as Severity },
                ].map(r => (
                  <div key={r.rule} className="bg-card border border-border rounded px-3.5 py-2.5 flex justify-between items-center">
                    <div>
                      <div className="text-xs text-foreground mb-0.5">{r.rule}</div>
                      <div className="text-[10px] text-muted-foreground">{r.threshold}</div>
                    </div>
                    <Tag severity={r.severity} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* -- ACTION TIMELINE ---------------------------------------------- */}
        {activeTab === "timeline" && (
          <div className="max-w-[680px]">
            <SectionHeader icon={<IconClipboardList size={15} />} title="User Action Timeline" />
            {auditLoading ? (
              <div className="p-12 text-center">
                <div className="font-mono text-sm text-muted-foreground opacity-70">Loading timeline\u2026</div>
              </div>
            ) : (
            Object.entries(byDate).map(([date, logs]) => (
              <div key={date} className="mb-7">
                <div className="text-[10px] font-mono text-muted-foreground tracking-widest mb-3 flex items-center gap-2.5">
                  {date}
                  <div className="flex-1 h-px bg-border" />
                  <span>{(logs as AuditLog[]).length} events</span>
                </div>
                <div className="relative pl-7">
                  <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />
                  {(logs as AuditLog[]).map((l, i) => {
                    const s = getSeverityStyle(l.severity);
                    return (
                      <div key={l.id} className="relative mb-3.5">
                        <div className={`absolute -left-[21px] top-[3px] w-[9px] h-[9px] rounded-full ${s.dot} border-2 border-background ${s.shadow}`} />
                        <div className="bg-card border border-border rounded px-3.5 py-2.5">
                          <div className="flex justify-between mb-0.5">
                            <span className="text-xs font-medium text-primary">
                              {(() => { const Ic = getActionIconComponent(l.action); return Ic ? <Ic size={14} stroke={1.5} /> : null; })()} {l.action}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">{l.ts.split(" ")[1]}</span>
                          </div>
                          <div className="text-xs text-foreground mb-1">{l.detail}</div>
                          <div className="flex gap-3 text-[10px] text-muted-foreground">
                            <span>{l.user}</span><span>\u00b7</span><span>{l.resource}</span><span>\u00b7</span><span>{l.ip}</span>
                            <div className="flex-1" />
                            <Tag severity={l.severity} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
            )}
          </div>
        )}

        {/* -- PERMISSION MATRIX -------------------------------------------- */}
        {activeTab === "perms" && (
          <div className="max-w-[700px]">
            <SectionHeader icon={<IconUsers size={15} />} title="Role-based Permission Matrix" />
            {!permissions ? (
              <div className="bg-card border border-border rounded px-4 py-8 text-center">
                <IconUsers size={24} stroke={1.5} className="mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="font-mono text-sm text-muted-foreground">No permission data available.</p>
                <p className="text-[10px] text-muted-foreground opacity-60 mt-1">Configure role permissions in the admin panel.</p>
              </div>
            ) : (
              <>
                <div className="border border-border rounded overflow-hidden">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted border-b border-border">
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Permission</th>
                        {(["participant", "organizer", "admin"] as RoleKey[]).map(r => (
                          <th key={r} className={`px-4 py-2.5 text-center font-bold text-xs capitalize ${r === "admin" ? "text-amber-500" : r === "organizer" ? "text-primary" : "text-green-500"}`}>{r}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(permissions.participant).map((perm, i) => (
                        <tr key={perm} className={`border-b border-border ${i % 2 === 0 ? "bg-card" : "bg-transparent"}`}>
                          <td className="px-4 py-2 text-foreground">{perm}</td>
                          {(["participant", "organizer", "admin"] as RoleKey[]).map(r => (
                            <td key={r} className="px-4 py-2 text-center">
                              <Check ok={permissions[r][perm]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-[10px] font-mono text-muted-foreground">
                  Permissions enforced at component and API level
                </div>
              </>
            )}
          </div>
        )}

        {/* -- ENCRYPTION STATUS -------------------------------------------- */}
        {activeTab === "encrypt" && (
          <div className="max-w-[680px]">
            <SectionHeader icon={<IconKey size={15} />} title="Data Encryption Status" />
            {encryption.length === 0 ? (
              <div className="bg-card border border-border rounded px-4 py-8 text-center">
                <IconKey size={24} stroke={1.5} className="mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="font-mono text-sm text-muted-foreground">No encryption data available.</p>
                <p className="text-[10px] text-muted-foreground opacity-60 mt-1">Encryption status will appear here once the backend is configured.</p>
              </div>
            ) : (
              <>
                <div className="bg-green-500/10 border border-green-500/30 rounded px-4 py-3 mb-5 flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_#00c851]" />
                  <span className="font-mono text-sm font-semibold text-green-500">All data encrypted</span>
                  <span className="text-xs text-muted-foreground ml-2">\u00b7 {encryption.length} of {encryption.length} data categories protected</span>
                </div>
                <div className="flex flex-col gap-2">
                  {paginatedEncryption.map(e => (
                    <div key={e.label} className="bg-card border border-border rounded px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-[7px] h-[7px] rounded-full bg-green-500 shrink-0 shadow-[0_0_4px_#00c851]" />
                        <span className="text-sm text-foreground">{e.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded">{e.algo}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase ${e.status === "encrypted" ? "text-green-500 bg-green-500/10 border border-green-500/30" : "text-yellow-500 bg-yellow-500/10 border border-yellow-500/30"}`}>{e.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Pagination page={encryptPage} totalItems={encryption.length} pageSize={ENCRYPT_PAGE_SIZE} onPageChange={setEncryptPage} />
              </>
            )}
          </div>
        )}

        {/* -- DATA RETENTION ----------------------------------------------- */}
        {activeTab === "retention" && (
          <div className="max-w-[640px]">
            <SectionHeader icon={<IconClipboardList size={15} />} title="Data Retention Policy Configuration" />
            {retention.length === 0 ? (
              <div className="bg-card border border-border rounded px-4 py-8 text-center">
                <IconClipboardList size={24} stroke={1.5} className="mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="font-mono text-sm text-muted-foreground">No retention policies configured.</p>
                <p className="text-[10px] text-muted-foreground opacity-60 mt-1">Data retention policies will appear here once configured by an administrator.</p>
              </div>
            ) : (
              <>
                <div className="bg-card border border-border rounded overflow-hidden mb-5">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted border-b border-border">
                        {["Data Category", "Retention Period", "Legal Basis", "Status"].map(h => (
                          <th key={h} className="px-3.5 py-2 text-left text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRetention.map((r, i) => {
                        const yrs = (r.current / 365).toFixed(1);
                        return (
                          <tr key={r.label} className={`border-b border-border ${i % 2 === 0 ? "bg-transparent" : "bg-muted"}`}>
                            <td className="px-3.5 py-2.5 text-foreground">{r.label}</td>
                            <td className="px-3.5 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="flex-1 h-[3px] bg-border rounded-sm min-w-[80px]">
                                  <div className="h-full bg-primary rounded-sm" style={{ width: `${Math.min((r.current / 2555) * 100, 100)}%` }} />
                                </div>
                                <span className="text-foreground whitespace-nowrap">{r.current} days</span>
                                <span className="text-muted-foreground text-[10px]">({yrs}y)</span>
                              </div>
                            </td>
                            <td className="px-3.5 py-2.5 text-muted-foreground text-[10px]">
                              {r.current >= 1825 ? "Legal obligation" : r.current >= 365 ? "Security compliance" : "Operational"}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span className="text-green-500 text-[10px] bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded">Active</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination page={retentionPage} totalItems={retention.length} pageSize={RETENTION_PAGE_SIZE} onPageChange={setRetentionPage} />
              </>
            )}
          </div>
        )}

          </div>
        </main>
      </div>
    </>
  );
}