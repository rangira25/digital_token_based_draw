'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, apiUrls } from '@/lib/api';
import { exportExcel, exportPDF, type ExportColumn } from '@/lib/export';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { IconUsers, IconClipboardList, IconReceipt, IconCheck, IconCircleCheck, IconX } from '@tabler/icons-react';
import { Pagination } from '@/components/Pagination';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
// NOTE: Access Requests, Permissions, and Active Session listing/revocation
// tabs were removed — there is no backend support for an organizer-approval
// workflow, a persisted permission matrix, or a session-listing/revoke
// endpoint in the routes/controllers this page has access to.

type TabType = 'overview' | 'users' | 'draws' | 'audit';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'Participant' | 'Organizer' | 'Administrator';
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  joinDate: string;
  lastActive: string;
  verified: boolean;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
}

interface DrawRow {
  id: string;
  title: string;
  status: string;
  draw_date: string;
  created_at: string;
  organizer_name: string;
  entry_count: string;
  prize_count: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: AdminUser['role'][] = ['Participant', 'Organizer', 'Administrator'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function exportExcelData(data: object[], filename: string, sheetName: string) {
  if (!data.length) return;
  const columns: ExportColumn[] = Object.keys(data[0]).map(k => ({ header: k.replace(/([A-Z])/g, ' $1').trim(), key: k }));
  exportExcel(data, columns, filename, sheetName);
}

function exportPDFData(data: object[], filename: string, title: string) {
  if (!data.length) return;
  const columns: ExportColumn[] = Object.keys(data[0]).map(k => ({ header: k.replace(/([A-Z])/g, ' $1').trim(), key: k }));
  exportPDF({ filename, title, subtitle: `${data.length} records`, columns, data });
}

const statusStyles: Record<string, string> = {
  active:    'bg-green-500/20 text-green-400',
  inactive:  'bg-gray-500/20  text-gray-400',
  pending:   'bg-yellow-500/20 text-yellow-400',
  suspended: 'bg-red-500/20   text-red-400',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPanel({ defaultTab }: { defaultTab?: TabType } = {}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab || 'overview');

  // ── Users ──
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editingUser, setEditingUser] = useState<Partial<AdminUser>>({});
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Draws ──
  const [draws, setDraws] = useState<DrawRow[]>([]);
  const [drawsLoading, setDrawsLoading] = useState(true);

  // ── Audit ──
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditSearch, setAuditSearch] = useState('');

  // ── Pagination ──
  const [usersPage, setUsersPage] = useState(1);
  const [drawsSearch, setDrawsSearch] = useState('');
  const [drawStatusFilter, setDrawStatusFilter] = useState('all');
  const [drawOrganizerFilter, setDrawOrganizerFilter] = useState('all');
  const [drawsPage, setDrawsPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const PAGE_SIZE = 10;

  // ── Guard ──
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

  // ── Fetch users from API ──
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    const fetchUsers = async () => {
      setUsersLoading(true);
      try {
        const res = await api<{ success: boolean; data: any[] }>(apiUrls.admin.users);
        const mapped: AdminUser[] = (res.data || []).map((u: any) => ({
          id: u.id,
          name: u.full_name || 'Unknown',
          email: u.email,
          role: u.role === 'admin' ? 'Administrator' : u.role === 'organizer' ? 'Organizer' : 'Participant',
          status: (u.status || 'active') as AdminUser['status'],
          joinDate: u.created_at?.split('T')[0] || '',
          lastActive: u.last_login_at?.split('T')[0] || '',
          verified: !!u.email_verified,
        }));
        setUsers(mapped);
      } catch {
        // handled by empty-state UI below
      } finally {
        setUsersLoading(false);
      }
    };
    fetchUsers();
  }, [user]);

  // ── Fetch draws from API ──
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    const fetchDraws = async () => {
      setDrawsLoading(true);
      try {
        const res = await api<{ success: boolean; data: DrawRow[] }>(apiUrls.draws.list);
        setDraws(res.data || []);
      } catch {
        // handled by empty-state UI below
      } finally {
        setDrawsLoading(false);
      }
    };
    fetchDraws();
  }, [user]);

  // ── Fetch audit from API ──
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    const fetchAudit = async () => {
      setAuditLoading(true);
      try {
        const res = await api<{ success: boolean; data: any[]; pagination?: { total: number } }>(apiUrls.audit.list);
        const mapped: AuditEntry[] = (res.data || []).map((l: any) => ({
          id: l.id,
          timestamp: l.created_at?.replace('T', ' ').slice(0, 19) || '',
          user: l.actor_email || 'system',
          action: l.action || 'Unknown',
          resource: l.entity_type || '',
        }));
        setAuditLog(mapped);
        setAuditTotal(res.pagination?.total ?? mapped.length);
      } catch {
        // handled by empty-state UI below
      } finally {
        setAuditLoading(false);
      }
    };
    fetchAudit();
  }, [user]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filteredUsers = useMemo(() => users.filter(u => {
    const q = searchTerm.toLowerCase();
    return (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      && (roleFilter === 'all' || u.role.toLowerCase() === roleFilter)
      && (statusFilter === 'all' || u.status === statusFilter);
  }), [users, searchTerm, roleFilter, statusFilter]);

  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, usersPage]);

  useEffect(() => { setUsersPage(1); }, [searchTerm, roleFilter, statusFilter]);

  const uniqueOrganizers = useMemo(() => {
    const names = [...new Set(draws.map(d => d.organizer_name).filter(Boolean))];
    return names.sort();
  }, [draws]);

  const filteredDraws = useMemo(() => draws.filter(d => {
    const matchSearch = (d.title || '').toLowerCase().includes(drawsSearch.toLowerCase());
    const matchStatus = drawStatusFilter === 'all' || (d.status || 'draft') === drawStatusFilter;
    const matchOrganizer = drawOrganizerFilter === 'all' || d.organizer_name === drawOrganizerFilter;
    return matchSearch && matchStatus && matchOrganizer;
  }), [draws, drawsSearch, drawStatusFilter, drawOrganizerFilter]);

  useEffect(() => { setDrawsPage(1); }, [drawsSearch, drawStatusFilter, drawOrganizerFilter]);

  const paginatedDraws = useMemo(() => {
    const start = (drawsPage - 1) * PAGE_SIZE;
    return filteredDraws.slice(start, start + PAGE_SIZE);
  }, [filteredDraws, drawsPage]);

  const filteredAudit = useMemo(() => auditLog.filter(a => {
    const q = auditSearch.toLowerCase();
    return q === '' || a.user.toLowerCase().includes(q) || a.action.toLowerCase().includes(q) || a.resource.toLowerCase().includes(q);
  }), [auditLog, auditSearch]);

  const paginatedAudit = useMemo(() => {
    const start = (auditPage - 1) * PAGE_SIZE;
    return filteredAudit.slice(start, start + PAGE_SIZE);
  }, [filteredAudit, auditPage]);

  useEffect(() => { setAuditPage(1); }, [auditSearch]);

  // Guard — MUST come after every hook above
  if (isLoading || !user || user.role !== 'admin') return null;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const openEdit = (u: AdminUser) => {
    setSelectedUser(u);
    setEditingUser({ ...u });
    setShowModal(true);
  };

  const saveEdit = async () => {
    if (!selectedUser) return;
    try {
      await api(apiUrls.admin.user(selectedUser.id), {
        method: 'PATCH',
        body: JSON.stringify({
          status: editingUser.status,
          role: editingUser.role?.toLowerCase(),
        }),
      });
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...editingUser } as AdminUser : u));
    } catch {
      // TODO: surface a toast — silently keeping prior UI state on failure for now
    }
    setShowModal(false);
  };

  const toggleStatus = async (id: string, status: AdminUser['status']) => {
    try {
      await api(apiUrls.admin.user(id), { method: 'PATCH', body: JSON.stringify({ status }) });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status } : u));
    } catch {
      // TODO: surface a toast
    }
  };

  const rawUsers = filteredUsers.map(({ id, name, email, role, status, joinDate, lastActive, verified }) =>
    ({ id, name, email, role, status, joinDate, lastActive, verified }));

  const exportUsers = (fmt: 'excel' | 'pdf') => {
    if (fmt === 'excel') exportExcelData(rawUsers, 'users_export', 'Users');
    else exportPDFData(rawUsers, 'users_export', 'Users Export');
  };

  const exportAudit = (fmt: 'excel' | 'pdf') => {
    if (fmt === 'excel') exportExcelData(auditLog, 'audit_log', 'Audit Log');
    else exportPDFData(auditLog, 'audit_log', 'Audit Log Export');
  };

  const iconMap: Record<string, React.ComponentType<any>> = {
    users: IconUsers, clipboard: IconClipboardList, receipt: IconReceipt,
  };

  const TABS: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'draws', label: 'Draws' },
    { id: 'audit', label: 'Audit Trail' },
  ];

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Admin Control Panel</h1>
          <p className="text-muted-foreground">Manage users and draw operations</p>
        </motion.div>

        {/* ── Tab Bar ── */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="flex gap-1 bg-muted rounded-lg p-1 flex-wrap w-fit"
        >
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded text-sm font-semibold transition-all ${
                activeTab === tab.id ? 'bg-[#3BB82E] text-white shadow-md' : 'text-muted-foreground hover:text-foreground hover:bg-primary/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* ════════════════════════════════════════════════════════════════════
            OVERVIEW
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">System Overview</h2>

            {/* Quick stats */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Total Users', value: usersLoading ? '—' : users.length, icon: 'users', color: 'bg-primary/5 border-primary/30', iconColor: 'text-primary' },
                { label: 'Total Draws', value: drawsLoading ? '—' : draws.length, icon: 'clipboard', color: 'bg-blue-500/10 border-blue-500/30', iconColor: 'text-blue-600' },
                { label: 'Audit Events', value: auditLoading ? '—' : auditTotal, icon: 'receipt', color: 'bg-orange-500/10 border-orange-500/30', iconColor: 'text-orange-600' },
              ].map((s, i) => (
                <div key={i} className={`${s.color} border rounded-lg p-4 flex items-center gap-4`}>
                  <span className={`text-3xl ${s.iconColor}`}>{(() => { const Ic = iconMap[s.icon]; return Ic ? <Ic size={28} stroke={1.5} /> : null; })()}</span>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* User Activity Monitor */}
            <div className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-bold text-foreground">User Status Breakdown</h3>
              {usersLoading ? (
                <p className="text-sm text-muted-foreground font-mono">Loading…</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Active', count: users.filter(u => u.status === 'active').length, fill: '#22c55e' },
                        { name: 'Inactive', count: users.filter(u => u.status === 'inactive').length, fill: '#9ca3af' },
                        { name: 'Pending', count: users.filter(u => u.status === 'pending').length, fill: '#eab308' },
                        { name: 'Suspended', count: users.filter(u => u.status === 'suspended').length, fill: '#ef4444' },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                        <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {[
                            { name: 'Active', fill: '#22c55e' },
                            { name: 'Inactive', fill: '#9ca3af' },
                            { name: 'Pending', fill: '#eab308' },
                            { name: 'Suspended', fill: '#ef4444' },
                          ].map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { label: 'Active', color: 'text-green-400 bg-green-500/10', filter: 'active' },
                      { label: 'Inactive', color: 'text-gray-400  bg-gray-500/10', filter: 'inactive' },
                      { label: 'Pending', color: 'text-yellow-400 bg-yellow-500/10', filter: 'pending' },
                      { label: 'Suspended', color: 'text-red-400   bg-red-500/10', filter: 'suspended' },
                    ] as const).map(s => (
                      <button key={s.label} onClick={() => { setActiveTab('users'); setStatusFilter(s.filter); }}
                        className={`rounded-lg p-4 ${s.color} hover:opacity-80 transition-opacity cursor-pointer`}
                      >
                        <p className="text-3xl font-bold">{users.filter(u => u.status === s.filter).length}</p>
                        <p className="text-xs mt-1 opacity-80">{s.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Role distribution */}
            <div className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-bold text-foreground">Role Distribution</h3>
              {usersLoading || users.length === 0 ? (
                <p className="text-sm text-muted-foreground font-mono">{usersLoading ? 'Loading…' : 'No users yet.'}</p>
              ) : (
                <div className="space-y-3">
                  {ROLES.map(role => {
                    const count = users.filter(u => u.role === role).length;
                    const pct = Math.round((count / users.length) * 100);
                    return (
                      <div key={role} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground font-medium">{role}</span>
                          <span className="text-muted-foreground font-mono">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                            className={`h-full rounded-full ${
                              role === 'Administrator' ? 'bg-purple-500' : role === 'Organizer' ? 'bg-blue-500' : 'bg-slate-300'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Draws Distribution */}
            <div className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-bold text-foreground">Draws by Status</h3>
              {drawsLoading ? (
                <p className="text-sm text-muted-foreground font-mono">Loading…</p>
              ) : draws.length === 0 ? (
                <p className="text-sm text-muted-foreground font-mono">No draws yet.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Open', value: draws.filter(d => d.status === 'open').length, fill: '#3BB82E' },
                          { name: 'Draft', value: draws.filter(d => d.status === 'draft').length, fill: '#94a3b8' },
                          { name: 'Completed', value: draws.filter(d => d.status === 'completed').length, fill: '#3b82f6' },
                        ].filter(d => d.value > 0)}
                        cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={4}
                        dataKey="value" label={({ name, value }) => `${name}: ${value}`}
                      >
                        {[
                          { fill: '#3BB82E' },
                          { fill: '#94a3b8' },
                          { fill: '#3b82f6' },
                        ].map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Recent activities */}
            <div className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-foreground">Recent Activity</h3>
                <button onClick={() => setActiveTab('audit')} className="text-xs text-slate-600 hover:underline">
                  View Full Audit →
                </button>
              </div>
              {auditLoading ? (
                <p className="text-sm text-muted-foreground font-mono">Loading…</p>
              ) : auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {auditLog.slice(0, 5).map((a, i) => (
                    <div key={i} className={`flex items-start justify-between p-3 border rounded ${i % 2 === 0 ? 'bg-muted border-primary/10' : 'bg-primary/5 border-primary/30'}`}>
                      <div>
                        <p className="font-semibold text-sm font-mono text-foreground">{a.action}</p>
                        <p className="text-xs text-muted-foreground">{a.user} · {a.resource}</p>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono shrink-0 ml-4">{a.timestamp}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            USERS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-2xl font-bold text-foreground">User Management</h2>
              <div className="flex gap-1 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => exportUsers('excel')}>↓ Export Excel</Button>
                <Button variant="outline" size="sm" onClick={() => exportUsers('pdf')}>↓ Export PDF</Button>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Input
                placeholder="Search by name or email…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="border-primary/20 bg-background text-foreground flex-1 min-w-[200px]"
              />
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                className="border border-primary/20 bg-background text-foreground rounded px-3 py-2 text-sm"
              >
                <option value="all">All Roles</option>
                {ROLES.map(r => <option key={r} value={r.toLowerCase()}>{r}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="border border-primary/20 bg-background text-foreground rounded px-3 py-2 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <p className="text-xs text-muted-foreground">
              {usersLoading ? 'Loading users…' : `Showing ${filteredUsers.length} of ${users.length} users`}
            </p>

            <div className="bg-card border border-primary/20 rounded-lg overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead className="border-b border-primary/20 bg-muted">
                  <tr>
                    {['Name', 'Email', 'Role', 'Status', 'Verified', 'Last Active', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {paginatedUsers.map((u, idx) => (
                    <motion.tr key={u.id}
                      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className={`transition-colors hover:bg-primary/5 ${idx % 2 === 0 ? '' : 'bg-primary/[0.04]'}`}
                    >
                      <td className="px-5 py-3 text-sm text-foreground font-medium">{u.name}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground font-mono">{u.email}</td>
                      <td className="px-5 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                          u.role === 'Administrator' ? 'bg-purple-500/20 text-purple-400' :
                          u.role === 'Organizer' ? 'bg-blue-500/20   text-blue-400' :
                          'bg-gray-500/20   text-gray-400'
                        }`}>{u.role}</span>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono ${statusStyles[u.status]}`}>
                          {u.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        {u.verified ? (
                          <span className="text-green-400 font-mono text-xs"><IconCircleCheck size={12} stroke={2} /> Verified</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground font-mono">{u.lastActive || '—'}</td>
                      <td className="px-5 py-3 text-sm">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(u)} className="text-slate-700 hover:text-slate-600 font-mono text-xs">Edit</button>
                          {u.status !== 'suspended' ? (
                            <button onClick={() => toggleStatus(u.id, 'suspended')} className="text-red-400 hover:text-red-300 font-mono text-xs">Suspend</button>
                          ) : (
                            <button onClick={() => toggleStatus(u.id, 'active')} className="text-green-400 hover:text-green-300 font-mono text-xs">Restore</button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                  {!usersLoading && filteredUsers.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground text-sm">No users match your filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination page={usersPage} totalItems={filteredUsers.length} pageSize={PAGE_SIZE} onPageChange={setUsersPage} />

            {/* ── Edit User Modal ── */}
            <AnimatePresence>
              {showModal && selectedUser && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                  onClick={e => e.target === e.currentTarget && setShowModal(false)}
                >
                  <motion.div
                    initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                    className="bg-card border border-primary/20 rounded-xl p-6 w-full max-w-md space-y-5 max-h-[90vh] overflow-y-auto"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-foreground">Edit User</h3>
                      <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none"><IconX size={18} stroke={1.5} /></button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Name</p>
                        <p className="text-sm text-foreground">{selectedUser.name}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Email</p>
                        <p className="text-sm text-foreground font-mono">{selectedUser.email}</p>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Role Assignment</label>
                        <div className="grid grid-cols-3 gap-2">
                          {ROLES.map(r => (
                            <button key={r} type="button"
                              onClick={() => setEditingUser(p => ({ ...p, role: r }))}
                              className={`p-2 rounded border-2 text-xs font-semibold transition-all ${
                                editingUser.role === r ? 'border-slate-900 bg-slate-900 text-white' : 'border-primary/20 text-muted-foreground hover:border-primary/40'
                              }`}
                            >{r}</button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Account Status</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['active', 'inactive', 'pending', 'suspended'] as AdminUser['status'][]).map(s => (
                            <button key={s} type="button"
                              onClick={() => setEditingUser(p => ({ ...p, status: s }))}
                              className={`p-2 rounded border-2 text-xs font-semibold capitalize transition-all ${
                                editingUser.status === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-primary/20 text-muted-foreground hover:border-primary/40'
                              }`}
                            >{s}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-primary/10">
                      <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                      <Button className="flex-1 bg-slate-800 text-white hover:bg-slate-700" onClick={saveEdit}>Save Changes</Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            DRAWS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'draws' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-2xl font-bold text-foreground">Draw Management</h2>
              <p className="text-xs text-muted-foreground">
                {drawsLoading ? 'Loading draws…' : `Showing ${filteredDraws.length} of ${draws.length} draws`}
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Input placeholder="Search draws by title…" value={drawsSearch}
                onChange={e => setDrawsSearch(e.target.value)}
                className="border-primary/20 bg-background text-foreground flex-1 min-w-[200px]" />
              <select value={drawStatusFilter} onChange={e => setDrawStatusFilter(e.target.value)}
                className="border border-primary/20 bg-background text-foreground rounded px-3 py-2 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="completed">Completed</option>
              </select>
              <select value={drawOrganizerFilter} onChange={e => setDrawOrganizerFilter(e.target.value)}
                className="border border-primary/20 bg-background text-foreground rounded px-3 py-2 text-sm max-w-[220px]"
              >
                <option value="all">All Organizers</option>
                {uniqueOrganizers.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            {drawsLoading ? (
              <p className="text-sm text-muted-foreground font-mono">Loading draws…</p>
            ) : paginatedDraws.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">No draws found.</p>
            ) : (
              <div className="grid gap-4">
                {paginatedDraws.map((draw, idx) => (
                  <motion.div key={draw.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`border rounded-lg p-6 space-y-4 transition-all duration-300 hover:bg-primary/5 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 ${
                      idx % 2 === 0 ? 'bg-card border-primary/20' : 'bg-primary/5 border-primary/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-foreground">{draw.title || 'Untitled Draw'}</h3>
                        <p className="text-sm text-muted-foreground">
                          Organizer: <span className="text-slate-700">{draw.organizer_name || '—'}</span>
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded text-xs font-mono font-bold ${
                        draw.status === 'open'
                          ? 'bg-green-500/15 text-green-600 border border-green-500/30'
                          : draw.status === 'completed'
                            ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30'
                            : draw.status === 'closed'
                              ? 'bg-red-500/15 text-red-500 border border-red-500/30'
                              : 'bg-yellow-500/15 text-yellow-600 border border-yellow-500/30'
                      }`}>{(draw.status || 'draft').toUpperCase()}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Entries</p>
                        <p className="text-2xl font-bold text-primary">{draw.entry_count ?? '0'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Prizes</p>
                        <p className="text-2xl font-bold text-foreground">{draw.prize_count ?? '0'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Draw Date</p>
                        <p className="text-sm text-foreground">{draw.draw_date ? new Date(draw.draw_date).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            <Pagination page={drawsPage} totalItems={filteredDraws.length} pageSize={PAGE_SIZE} onPageChange={setDrawsPage} />
          </motion.div>
        )}

        {/* 
            AUDIT TRAIL
         */}
        {activeTab === 'audit' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Audit Trail</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {auditLoading ? 'Loading…' : `${auditTotal} total event${auditTotal !== 1 ? 's' : ''} logged (showing most recent ${auditLog.length})`}
                </p>
              </div>
              <div className="flex gap-1 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => exportAudit('excel')}>↓ Export Excel</Button>
                <Button variant="outline" size="sm" onClick={() => exportAudit('pdf')}>↓ Export PDF</Button>
              </div>
            </div>

            <Input
              placeholder="Search by user, action, resource…"
              value={auditSearch}
              onChange={e => setAuditSearch(e.target.value)}
              className="border-primary/20 bg-background text-foreground"
            />

            <div className="bg-card border border-primary/20 rounded-lg overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="border-b border-primary/20 bg-muted">
                  <tr>
                    {['Timestamp', 'User', 'Action', 'Resource'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {paginatedAudit.map((a, i) => (
                    <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.025 }}
                      className={`transition-colors hover:bg-primary/5 ${i % 2 === 0 ? '' : 'bg-primary/[0.04]'}`}
                    >
                      <td className="px-5 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">{a.timestamp}</td>
                      <td className="px-5 py-3 text-sm text-foreground font-mono">{a.user}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-mono bg-primary/10 text-foreground px-2 py-0.5 rounded">{a.action}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground font-mono">{a.resource}</td>
                    </motion.tr>
                  ))}
                  {!auditLoading && filteredAudit.length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground text-sm">No audit entries match your search</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={auditPage} totalItems={filteredAudit.length} pageSize={PAGE_SIZE} onPageChange={setAuditPage} />
          </motion.div>
        )}

      </div>
    </main>
  </div>
  );
}