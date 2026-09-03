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

// -- Mock Data ----------------------------------------------------------------

const AUDIT_LOGS: AuditLog[] = [
  { id: "AL001", ts: "2026-05-20 14:32:11", user: "admin@draw.io", role: "admin", action: "DRAW_CONFIG_CHANGE", resource: "Draw #DR-2024", detail: "Max participants changed: 500\u21921000", severity: "medium", ip: "196.12.4.21" },
  { id: "AL002", ts: "2026-05-20 14:28:05", user: "jane@events.rw", role: "organizer", action: "TOKEN_GENERATED", resource: "Draw #DR-2024", detail: "500 tokens batch-generated", severity: "low", ip: "196.12.4.98" },
  { id: "AL003", ts: "2026-05-20 14:10:44", user: "admin@draw.io", role: "admin", action: "LOGIN_SUCCESS", resource: "Auth", detail: "2FA verified, session started", severity: "low", ip: "196.12.4.21" },
  { id: "AL004", ts: "2026-05-20 13:55:02", user: "unknown@test.com", role: "\u2014", action: "LOGIN_FAILED", resource: "Auth", detail: "Invalid credentials (attempt 4/5)", severity: "high", ip: "41.86.12.3" },
  { id: "AL005", ts: "2026-05-20 13:40:18", user: "jane@events.rw", role: "organizer", action: "WINNER_SELECTED", resource: "Draw #DR-2023", detail: "Winner: TKN-00291 \u2192 John M.", severity: "low", ip: "196.12.4.98" },
  { id: "AL006", ts: "2026-05-20 13:22:55", user: "admin@draw.io", role: "admin", action: "ANOMALY_FLAGGED", resource: "Draw #DR-2023", detail: "Rapid token generation detected (120 req/min)", severity: "critical", ip: "\u2014" },
  { id: "AL007", ts: "2026-05-20 12:59:31", user: "clerk@events.rw", role: "organizer", action: "PRIZE_CLAIM_MODIFIED", resource: "Claim #PC-441", detail: "Prize amount updated: 500K\u2192450K RWF", severity: "medium", ip: "196.12.4.77" },
  { id: "AL008", ts: "2026-05-20 12:44:09", user: "jane@events.rw", role: "organizer", action: "DRAW_CONFIG_CHANGE", resource: "Draw #DR-2025", detail: "Draw end date extended by 7 days", severity: "medium", ip: "196.12.4.98" },
  { id: "AL009", ts: "2026-05-20 11:30:00", user: "system", role: "system", action: "TOKEN_GENERATED", resource: "Draw #DR-2025", detail: "1000 tokens auto-generated on draw creation", severity: "low", ip: "internal" },
  { id: "AL010", ts: "2026-05-20 10:15:22", user: "admin@draw.io", role: "admin", action: "ROLE_CHANGED", resource: "user:clerk@events.rw", detail: "Role: participant \u2192 organizer", severity: "high", ip: "196.12.4.21" },
  { id: "AL011", ts: "2026-05-19 17:02:44", user: "jane@events.rw", role: "organizer", action: "WINNER_SELECTED", resource: "Draw #DR-2022", detail: "Winner: TKN-00088 \u2192 Alice K.", severity: "low", ip: "196.12.4.98" },
  { id: "AL012", ts: "2026-05-19 16:45:10", user: "unknown", role: "\u2014", action: "LOGIN_FAILED", resource: "Auth", detail: "Account locked after 5 failed attempts", severity: "critical", ip: "41.86.12.3" },
];

const ANOMALIES: Anomaly[] = [
  { id: "AN001", ts: "2026-05-20 13:22:55", type: "Rapid Token Generation", detail: "120 token requests/min \u2014 threshold: 20/min", severity: "critical", resolved: false },
  { id: "AN002", ts: "2026-05-20 13:55:02", type: "Brute-force Attempt", detail: "4 failed logins in 3 min from 41.86.12.3", severity: "high", resolved: false },
  { id: "AN003", ts: "2026-05-19 16:45:10", type: "Account Lockout", detail: "unknown@test.com locked \u2014 5 failed attempts", severity: "high", resolved: true },
  { id: "AN004", ts: "2026-05-18 09:12:33", type: "Off-hours Config Change", detail: "Draw config modified at 02:12 AM by organizer", severity: "medium", resolved: true },
];

const PERMISSIONS: Record<RoleKey, Record<string, boolean>> = {
  participant:   { "View Draws": true,  "Enter Draw": true,  "View Own Tokens": true,  "Claim Prize": true,  "View Others' Tokens": false, "Create Draw": false, "Modify Draw": false, "Generate Tokens": false, "Select Winner": false, "View Audit Log": false, "Manage Users": false, "Export Data": false },
  organizer:     { "View Draws": true,  "Enter Draw": false, "View Own Tokens": false, "Claim Prize": false, "View Others' Tokens": true,  "Create Draw": true,  "Modify Draw": true,  "Generate Tokens": true,  "Select Winner": true,  "View Audit Log": true,  "Manage Users": false, "Export Data": true  },
  admin: { "View Draws": true,  "Enter Draw": false, "View Own Tokens": false, "Claim Prize": false, "View Others' Tokens": true,  "Create Draw": true,  "Modify Draw": true,  "Generate Tokens": true,  "Select Winner": true,  "View Audit Log": true,  "Manage Users": true,  "Export Data": true  },
};

const ENCRYPTION = [
  { label: "Draw Configuration Data", status: "encrypted", algo: "AES-256-GCM" },
  { label: "Token Pool Storage",       status: "encrypted", algo: "AES-256-GCM" },
  { label: "User PII (Name, Email)",   status: "encrypted", algo: "AES-256-CBC" },
  { label: "National ID / Passport",   status: "encrypted", algo: "AES-256-CBC + KMS" },
  { label: "Audit Log Records",        status: "encrypted", algo: "AES-256-GCM" },
  { label: "Session Tokens",           status: "encrypted", algo: "HMAC-SHA256" },
  { label: "Backup Codes",             status: "hashed",    algo: "bcrypt (cost 12)" },
  { label: "Passwords",                status: "hashed",    algo: "bcrypt (cost 12)" },
  { label: "Data-in-Transit",          status: "encrypted", algo: "TLS 1.3" },
];

const RETENTION: RetentionItem[] = [
  { label: "Audit Logs",      current: 365  },
  { label: "Login Activity",  current: 90   },
  { label: "Draw Records",    current: 1825 },
  { label: "Winner Records",  current: 1825 },
  { label: "Token Logs",      current: 365  },
  { label: "Prize Claims",    current: 2555 },
];

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
  const [auditLogs, setAuditLogs]       = useState<any[]>(AUDIT_LOGS);
  const [auditLoading, setAuditLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [anomalyPage, setAnomalyPage] = useState(1);
  const ANOMALY_PAGE_SIZE = 5;
  const [encryptPage, setEncryptPage] = useState(1);
  const ENCRYPT_PAGE_SIZE = 5;
  const [retentionPage, setRetentionPage] = useState(1);
  const RETENTION_PAGE_SIZE = 5;

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
  const paginatedAnomalies = useMemo(() => ANOMALIES.slice((anomalyPage - 1) * ANOMALY_PAGE_SIZE, anomalyPage * ANOMALY_PAGE_SIZE), [anomalyPage]);
  const paginatedEncryption = useMemo(() => ENCRYPTION.slice((encryptPage - 1) * ENCRYPT_PAGE_SIZE, encryptPage * ENCRYPT_PAGE_SIZE), [encryptPage]);
  const paginatedRetention = useMemo(() => RETENTION.slice((retentionPage - 1) * RETENTION_PAGE_SIZE, retentionPage * RETENTION_PAGE_SIZE), [retentionPage]);

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
                { label: "Critical Alerts", val: ANOMALIES.filter(a => a.severity === "critical" && !a.resolved).length, colorClass: "text-red-500" },
                { label: "Open Anomalies",  val: ANOMALIES.filter(a => !a.resolved).length,                              colorClass: "text-amber-500" },
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
              <table className="w-full border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-muted/60 border-b border-border text-primary/80">
                    {["ID", "Timestamp", "User", "Role", "Action", "Resource", "Detail", "Severity", "IP"].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-[10px] font-bold tracking-widest uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((l, i) => {
                    const s = getSeverityStyle(l.severity);
                    return (
                      <motion.tr key={l.id}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className={`border-b border-border ${i % 2 === 0 ? "bg-transparent" : "bg-muted/20"} hover:bg-primary/[0.04] transition-colors`}>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${s.glow} shrink-0`} />
                            <span className={`${s.text} font-bold`}>{l.id}</span>
                          </span>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{l.ts}</td>
                        <td className="px-3 py-3 text-foreground">{l.user}</td>
                        <td className="px-3 py-3">
                          <span className={`text-muted-foreground capitalize ${l.role === "admin" ? "text-amber-600 font-semibold" : l.role === "organizer" ? "text-primary font-semibold" : ""}`}>{l.role}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/5 border border-primary/10 text-primary text-[10px]">
                            <span className="opacity-80">{(() => { const Ic = getActionIconComponent(l.action); return Ic ? <Ic size={13} stroke={1.5} /> : null; })()}</span>
                            {l.action}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-foreground">{l.resource}</td>
                        <td className="px-3 py-3 text-muted-foreground max-w-[240px] truncate">{l.detail}</td>
                        <td className="px-3 py-3"><Tag severity={l.severity} /></td>
                        <td className="px-3 py-3 text-muted-foreground">{l.ip}</td>
                      </motion.tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="p-8 text-center text-muted-foreground text-xs">No records match the current filters</td></tr>
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
              {paginatedAnomalies.map(a => {
                const s = getSeverityStyle(a.severity);
                return (
                  <div key={a.id} className={`rounded px-4 py-3.5 flex items-start gap-4 ${a.resolved ? "bg-card border border-border opacity-50" : `${s.bg} border ${s.border} ${s.shadow}`}`}>
                    <div className={`mt-[3px] w-2 h-2 rounded-full shrink-0 ${a.resolved ? "bg-muted-foreground" : `${s.dot} ${s.glow}`}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className={`font-mono text-sm font-semibold ${a.resolved ? "text-muted-foreground" : "text-foreground"}`}>{a.type}</span>
                        <Tag severity={a.severity} />
                        {a.resolved && <span className="text-[10px] font-mono text-muted-foreground bg-muted border border-border px-1.5 py-px rounded">resolved</span>}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mb-1">{a.detail}</div>
                      <div className="text-[10px] text-muted-foreground opacity-60">{a.ts} \u00b7 {a.id}</div>
                    </div>
                    {!a.resolved && (
                      <button className={`border ${s.border} ${s.text} bg-transparent px-3 py-1 text-[10px] rounded font-mono shrink-0 cursor-pointer transition-colors hover:bg-primary/5 active:scale-95 active:bg-primary/10`}>
                        Investigate &rarr;
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <Pagination page={anomalyPage} totalItems={ANOMALIES.length} pageSize={ANOMALY_PAGE_SIZE} onPageChange={setAnomalyPage} />

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
                      <div className="text-xs font-mono text-foreground mb-0.5">{r.rule}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{r.threshold}</div>
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
                            <span className="font-mono text-xs text-primary">
                              {(() => { const Ic = getActionIconComponent(l.action); return Ic ? <Ic size={14} stroke={1.5} /> : null; })()} {l.action}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">{l.ts.split(" ")[1]}</span>
                          </div>
                          <div className="text-xs text-foreground mb-1">{l.detail}</div>
                          <div className="flex gap-3 text-[10px] text-muted-foreground font-mono">
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
            <div className="border border-border rounded overflow-hidden">
              <table className="w-full border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Permission</th>
                    {(["participant", "organizer", "admin"] as RoleKey[]).map(r => (
                      <th key={r} className={`px-4 py-2.5 text-center font-bold text-xs capitalize ${r === "admin" ? "text-amber-500" : r === "organizer" ? "text-primary" : "text-green-500"}`}>{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(PERMISSIONS.participant).map((perm, i) => (
                    <tr key={perm} className={`border-b border-border ${i % 2 === 0 ? "bg-card" : "bg-transparent"}`}>
                      <td className="px-4 py-2 text-foreground">{perm}</td>
                      {(["participant", "organizer", "admin"] as RoleKey[]).map(r => (
                        <td key={r} className="px-4 py-2 text-center">
                          <Check ok={PERMISSIONS[r][perm]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-[10px] font-mono text-muted-foreground">
              Permissions enforced at component and API level \u00b7 Last updated: 2026-05-20
            </div>
          </div>
        )}

        {/* -- ENCRYPTION STATUS -------------------------------------------- */}
        {activeTab === "encrypt" && (
          <div className="max-w-[680px]">
            <SectionHeader icon={<IconKey size={15} />} title="Data Encryption Status" />
            <div className="bg-green-500/10 border border-green-500/30 rounded px-4 py-3 mb-5 flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_#00c851]" />
              <span className="font-mono text-sm font-semibold text-green-500">All data encrypted</span>
              <span className="text-xs text-muted-foreground ml-2">\u00b7 {ENCRYPTION.length} of {ENCRYPTION.length} data categories protected</span>
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
            <Pagination page={encryptPage} totalItems={ENCRYPTION.length} pageSize={ENCRYPT_PAGE_SIZE} onPageChange={setEncryptPage} />
            <div className="mt-6">
              <SectionHeader icon={<IconKey size={15} />} title="Key Management" />
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "Key Rotation",  value: "Every 90 days", ok: true },
                  { label: "Last Rotation", value: "2026-03-15",    ok: true },
                  { label: "KMS Provider",  value: "AWS KMS",       ok: true },
                  { label: "Key Escrow",    value: "Enabled",       ok: true },
                ].map(k => (
                  <div key={k.label} className="bg-card border border-border rounded px-3.5 py-2.5 flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{k.label}</span>
                    <div className="flex items-center gap-1.5">
                      <Check ok={k.ok} />
                      <span className="text-xs font-mono text-foreground">{k.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* -- DATA RETENTION ----------------------------------------------- */}
        {activeTab === "retention" && (
          <div className="max-w-[640px]">
            <SectionHeader icon={<IconClipboardList size={15} />} title="Data Retention Policy Configuration" />
            <div className="bg-card border border-border rounded overflow-hidden mb-5">
              <table className="w-full border-collapse text-xs font-mono">
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
            <Pagination page={retentionPage} totalItems={RETENTION.length} pageSize={RETENTION_PAGE_SIZE} onPageChange={setRetentionPage} />
            <SectionHeader icon={<IconAlertTriangle size={15} />} title="Auto-deletion Policy" />
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "Scheduled Deletion",    value: "Nightly 02:00 UTC",   ok: true },
                { label: "Deletion Confirmation", value: "Dual admin sign-off", ok: true },
                { label: "Soft Delete First",     value: "30-day grace period", ok: true },
                { label: "Compliance Export",     value: "Before deletion",     ok: true },
              ].map(p => (
                <div key={p.label} className="bg-card border border-border rounded px-3.5 py-2.5">
                  <div className="text-[10px] text-muted-foreground mb-1">{p.label}</div>
                  <div className="flex items-center gap-1.5">
                    <Check ok={p.ok} />
                    <span className="text-xs font-mono text-foreground">{p.value}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3.5 px-3.5 py-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-500 font-mono">
              <IconAlertTriangle size={12} /> Policy changes require administrator approval and are recorded in the audit log
            </div>
          </div>
        )}

          </div>
        </main>
      </div>
    </>
  );
}