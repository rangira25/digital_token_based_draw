'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useRef, Fragment, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, apiUrls } from '@/lib/api';
import { exportExcel, exportPDF, type ExportColumn } from '@/lib/export';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { IconUsers, IconClipboardList, IconLink, IconReceipt, IconCheck, IconCircleCheck, IconMail, IconX } from '@tabler/icons-react';
import { Pagination } from '@/components/Pagination';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabType = 'overview' | 'users' | 'draws' | 'security' | 'audit' | 'requests' | 'permissions';

interface SystemMetric {
  label: string;
  value: string | number;
  status: 'healthy' | 'warning' | 'critical';
}

interface MockUser {
  id: string;
  name: string;
  email: string;
  role: 'Participant' | 'Organizer' | 'Administrator';
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  joinDate: string;
  lastActive: string;
  verified: boolean;
  ip: string;
  sessions: number;
}

interface AccessRequest {
  id: string;
  name: string;
  email: string;
  company: string;
  license: string;
  role: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  ip: string;
  result: 'success' | 'failure' | 'warning';
}

interface ActiveSession {
  id: string;
  userId: string;
  userName: string;
  device: string;
  ip: string;
  location: string;
  startedAt: string;
  lastActivity: string;
}

interface Permission {
  id: string;
  label: string;
  category: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: MockUser['role'][] = ['Participant', 'Organizer', 'Administrator'];

const PERMISSIONS: Permission[] = [
  { id: 'view_draws',         label: 'View Draws',          category: 'Draws'   },
  { id: 'create_draws',       label: 'Create Draws',         category: 'Draws'   },
  { id: 'edit_draws',         label: 'Edit Draws',           category: 'Draws'   },
  { id: 'delete_draws',       label: 'Delete Draws',         category: 'Draws'   },
  { id: 'run_draws',          label: 'Run Draws',            category: 'Draws'   },
  { id: 'view_users',         label: 'View Users',           category: 'Users'   },
  { id: 'edit_users',         label: 'Edit Users',           category: 'Users'   },
  { id: 'disable_users',      label: 'Disable Users',        category: 'Users'   },
  { id: 'export_users',       label: 'Export Users',         category: 'Users'   },
  { id: 'view_reports',       label: 'View Reports',         category: 'Reports' },
  { id: 'export_reports',     label: 'Export Reports',       category: 'Reports' },
  { id: 'view_audit',         label: 'View Audit Logs',      category: 'System'  },
  { id: 'manage_security',    label: 'Manage Security',      category: 'System'  },
  { id: 'manage_permissions', label: 'Manage Permissions',   category: 'System'  },
  { id: 'approve_requests',   label: 'Approve Requests',     category: 'System'  },
];

const PERM_CATEGORIES = Array.from(new Set(PERMISSIONS.map(p => p.category)));

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_REQUESTS: AccessRequest[] = [
  { id: 'REQ001', name: 'Grace Hopper', email: 'grace@techco.com',     company: 'TechCo Ltd',   license: 'EOL-2024-00123', role: 'organizer', submittedAt: '2026-05-17 09:30', status: 'pending' },
  { id: 'REQ002', name: 'Hank Pym',    email: 'hank@scienceorg.com',   company: 'Science Org',  license: 'EOL-2024-00456', role: 'organizer', submittedAt: '2026-05-16 14:22', status: 'pending' },
  { id: 'REQ003', name: 'Irene Adler', email: 'irene@events.co',       company: 'Events Co.',   license: 'EOL-2024-00789', role: 'organizer', submittedAt: '2026-05-15 11:05', status: 'approved' },
  { id: 'REQ004', name: 'Jack Ryan',   email: 'jack@intel.org',         company: 'Intel Org',    license: 'EOL-INVALID',    role: 'organizer', submittedAt: '2026-05-14 08:15', status: 'rejected', notes: 'Invalid license number' },
];

const INITIAL_PERM_MATRIX: Record<string, Set<string>> = {
  Participant:   new Set(['view_draws']),
  Organizer:     new Set(['view_draws', 'create_draws', 'edit_draws', 'run_draws', 'view_reports', 'export_reports']),
  Administrator: new Set(PERMISSIONS.map(p => p.id)),
};

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

const resultStyles: Record<string, string> = {
  success: 'bg-green-500/20 text-green-400',
  failure: 'bg-red-500/20   text-red-400',
  warning: 'bg-yellow-500/20 text-yellow-400',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const { user } = useAuth();
  const router   = useRouter();

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // ── Users ──
  const [users,       setUsers]       = useState<MockUser[]>([]);
  const [searchTerm,  setSearchTerm]  = useState('');
  const [roleFilter,  setRoleFilter]  = useState('all');
  const [statusFilter,setStatusFilter]= useState('all');
  const [selectedUser,setSelectedUser]= useState<MockUser | null>(null);
  const [editingUser, setEditingUser] = useState<Partial<MockUser>>({});
  const [showModal,   setShowModal]   = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  // ── Access Requests ──
  const [requests,      setRequests]      = useState<AccessRequest[]>(INITIAL_REQUESTS);
  const [requestNotes,  setRequestNotes]  = useState<Record<string, string>>({});
  const [reqFilter,     setReqFilter]     = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  // ── Draws ──
  const [draws, setDraws] = useState<any[]>([]);

  // ── Audit ──
  const [auditLog, setAuditLog]           = useState<AuditEntry[]>([]);
  const [auditSearch,  setAuditSearch]  = useState('');
  const [auditResult,  setAuditResult]  = useState<'all' | 'success' | 'failure' | 'warning'>('all');

  // ── Sessions ──
  const [sessions, setSessions] = useState<ActiveSession[]>([]);

  // ── Permissions ──
  const [permMatrix, setPermMatrix] = useState<Record<string, Set<string>>>(INITIAL_PERM_MATRIX);
  const [permSaved,  setPermSaved]  = useState(false);

  // ── Pagination ──
  const [usersPage, setUsersPage]     = useState(1);
  const [drawsPage, setDrawsPage]     = useState(1);
  const [auditPage, setAuditPage]     = useState(1);
  const [requestsPage, setRequestsPage] = useState(1);
  const PAGE_SIZE = 10;

  // ── Fetch users from API ──
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api<{ success: boolean; data: any[] }>(apiUrls.admin.users);
        const mapped: MockUser[] = (res.data || []).map((u: any) => ({
          id: u.id,
          name: u.full_name || u.name || u.username || 'Unknown',
          email: u.email,
          role: u.role === 'admin' ? 'Administrator' : u.role === 'organizer' ? 'Organizer' : 'Participant',
          status: (u.status || 'active') as MockUser['status'],
          joinDate: u.created_at?.split('T')[0] || '',
          lastActive: u.last_login_at?.split('T')[0] || u.updated_at?.split('T')[0] || '',
          verified: !!u.email_verified,
          ip: u.last_ip || '—',
          sessions: 0,
        }));
        setUsers(mapped);
      } catch {}
    };
    fetchUsers();
  }, []);

  // ── Fetch draws from API ──
  useEffect(() => {
    const fetchDraws = async () => {
      try {
        const res = await api<{ success: boolean; data: any[] }>(apiUrls.draws.list);
        setDraws(res.data || []);
      } catch {}
    };
    fetchDraws();
  }, []);

  // ── Fetch audit from API ──
  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const res = await api<{ success: boolean; data: any[] }>(apiUrls.audit.list);
        const mapped: AuditEntry[] = (res.data || []).map((l: any) => ({
          id: l.id,
          timestamp: l.created_at?.replace('T', ' ').slice(0, 19) || '',
          user: l.actor_email || l.user?.email || 'system',
          action: l.action || 'Unknown',
          resource: l.entity_type || '',
          ip: l.ip_address || '—',
          result: (l.status === 'success' ? 'success' : l.status === 'failure' ? 'failure' : 'warning') as AuditEntry['result'],
        }));
        setAuditLog(mapped);
      } catch {}
    };
    fetchAudit();
  }, []);

  // ── Guard ──
  if (!user || user.role !== 'organizer') {
    router.push('/auth');
    return null;
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const systemMetrics: SystemMetric[] = [
    { label: 'System Status',    value: 'Online',                                          status: 'healthy'  },
    { label: 'Total Users',      value: users.length,                                       status: 'healthy'  },
    { label: 'Active Users',     value: users.filter(u => u.status === 'active').length,   status: 'healthy'  },
    { label: 'Pending Requests', value: requests.filter(r => r.status === 'pending').length, status: 'warning' },
    { label: 'Total Draws',      value: draws.length,                                        status: 'healthy'  },
    { label: 'Audit Events',     value: auditLog.length,                                     status: 'healthy'  },
  ];

  const filteredUsers = useMemo(() => users.filter(u => {
    const q = searchTerm.toLowerCase();
    return (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      && (roleFilter   === 'all' || u.role.toLowerCase()  === roleFilter)
      && (statusFilter === 'all' || u.status              === statusFilter);
  }), [users, searchTerm, roleFilter, statusFilter]);

  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, usersPage]);

  useEffect(() => { setUsersPage(1); }, [searchTerm, roleFilter, statusFilter]);

  const filteredDraws = useMemo(() => draws.filter(d =>
    (d.title || d.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  ), [draws, searchTerm]);

  const paginatedDraws = useMemo(() => {
    const start = (drawsPage - 1) * PAGE_SIZE;
    return filteredDraws.slice(start, start + PAGE_SIZE);
  }, [filteredDraws, drawsPage]);

  useEffect(() => { setDrawsPage(1); }, [searchTerm]);

  const filteredAudit = useMemo(() => auditLog.filter(a => {
    const q = auditSearch.toLowerCase();
    return (q === '' || a.user.includes(q) || a.action.toLowerCase().includes(q) || a.resource.toLowerCase().includes(q))
      && (auditResult === 'all' || a.result === auditResult);
  }), [auditLog, auditSearch, auditResult]);

  const paginatedAudit = useMemo(() => {
    const start = (auditPage - 1) * PAGE_SIZE;
    return filteredAudit.slice(start, start + PAGE_SIZE);
  }, [filteredAudit, auditPage]);

  useEffect(() => { setAuditPage(1); }, [auditSearch, auditResult]);

  const filteredRequests = useMemo(() => requests.filter(r =>
    reqFilter === 'all' ? true : r.status === reqFilter
  ), [requests, reqFilter]);

  const paginatedRequests = useMemo(() => {
    const start = (requestsPage - 1) * PAGE_SIZE;
    return filteredRequests.slice(start, start + PAGE_SIZE);
  }, [filteredRequests, requestsPage]);

  useEffect(() => { setRequestsPage(1); }, [reqFilter]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const openEdit = (u: MockUser) => {
    setSelectedUser(u);
    setEditingUser({ ...u });
    setShowModal(true);
  };

  const saveEdit = async () => {
    if (!selectedUser) return;
    try {
      await api(apiUrls.admin.user(selectedUser.id), {
        method: 'PATCH',
        body: JSON.stringify({ name: editingUser.name, email: editingUser.email, role: editingUser.role?.toLowerCase() }),
      });
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...editingUser } as MockUser : u));
    } catch {}
    setShowModal(false);
  };

  const toggleStatus = async (id: string, status: MockUser['status']) => {
    try {
      await api(apiUrls.admin.user(id), {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status } : u));
    } catch {}
  };

  const verifyOrganizer = async (id: string) => {
    try {
      await api(apiUrls.admin.user(id), {
        method: 'PATCH',
        body: JSON.stringify({ verified: true, status: 'active' }),
      });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, verified: true, status: 'active' } : u));
    } catch {}
  };

  const handleRequest = (id: string, action: 'approved' | 'rejected') =>
    setRequests(prev => prev.map(r =>
      r.id === id ? { ...r, status: action, notes: requestNotes[id] || r.notes } : r
    ));

  const revokeSession = (id: string) =>
    setSessions(prev => prev.filter(s => s.id !== id));

  const togglePerm = (role: string, permId: string) => {
    if (role === 'Administrator') return;
    setPermMatrix(prev => {
      const next = { ...prev, [role]: new Set(prev[role]) };
      next[role].has(permId) ? next[role].delete(permId) : next[role].add(permId);
      return next;
    });
    setPermSaved(false);
  };

  const savePerms = () => {
    setPermSaved(true);
    setTimeout(() => setPermSaved(false), 2500);
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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    alert(`[Mock] Importing "${file.name}" — ${file.size} bytes`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const iconMap: Record<string, React.ComponentType<any>> = {
    users: IconUsers, clipboard: IconClipboardList, link: IconLink, receipt: IconReceipt,
  };

  // ── Tab config ───────────────────────────────────────────────────────────────

  const TABS: { id: TabType; label: string; badge?: number }[] = [
    { id: 'overview',     label: 'Overview'         },
    { id: 'users',        label: 'Users'            },
    { id: 'draws',        label: 'Draws'            },
    { id: 'security',     label: 'Security'         },
    { id: 'audit',        label: 'Audit Trail'      },
    { id: 'requests',     label: 'Access Requests', badge: pendingCount },
    { id: 'permissions',  label: 'Permissions'      },
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
          <p className="text-muted-foreground">Manage system, users, roles, and draw operations</p>
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
              className={`relative px-4 py-2 rounded font-mono text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </motion.div>

        {/* ════════════════════════════════════════════════════════════════════
            OVERVIEW
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">System Overview</h2>

            {/* Metric cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {systemMetrics.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={`border rounded-lg p-6 space-y-2 ${
                    m.status === 'healthy' ? 'border-green-500/30 bg-green-500/5' :
                    m.status === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5' :
                    'border-red-500/30 bg-red-500/5'
                  }`}
                >
                  <p className="text-sm text-muted-foreground">{m.label}</p>
                  <p className={`text-2xl font-bold ${
                    m.status === 'healthy' ? 'text-green-400' :
                    m.status === 'warning' ? 'text-yellow-400' : 'text-red-400'
                  }`}>{m.value}</p>
                  <span className={`text-xs font-mono ${
                    m.status === 'healthy' ? 'text-green-400' :
                    m.status === 'warning' ? 'text-yellow-400' : 'text-red-400'
                  }`}>{m.status.toUpperCase()}</span>
                </motion.div>
              ))}
            </div>

            {/* Quick stats */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Users',        value: users.length,        icon: 'users' },
                { label: 'Pending Requests',   value: pendingCount,        icon: 'clipboard' },
                { label: 'Active Sessions',    value: sessions.length,     icon: 'link' },
                { label: 'Audit Events (24h)', value: auditLog.length,     icon: 'receipt' },
              ].map((s, i) => (
                <div key={i} className="bg-card border border-primary/20 rounded-lg p-4 flex items-center gap-4">
                  <span className="text-3xl text-muted-foreground">{(() => { const Ic = iconMap[s.icon]; return Ic ? <Ic size={28} stroke={1.5} /> : null; })()}</span>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* User Activity Monitor */}
            <div className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-bold text-foreground">User Activity Monitor</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {([
                  { label: 'Active',    color: 'text-green-400 bg-green-500/10',  filter: 'active'    },
                  { label: 'Inactive',  color: 'text-gray-400  bg-gray-500/10',   filter: 'inactive'  },
                  { label: 'Pending',   color: 'text-yellow-400 bg-yellow-500/10',filter: 'pending'   },
                  { label: 'Suspended', color: 'text-red-400   bg-red-500/10',    filter: 'suspended' },
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

            {/* Role distribution */}
            <div className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-bold text-foreground">Role Distribution</h3>
              <div className="space-y-3">
                {ROLES.map(role => {
                  const count = users.filter(u => u.role === role).length;
                  const pct   = Math.round((count / users.length) * 100);
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
                            role === 'Administrator' ? 'bg-purple-500' :
                            role === 'Organizer'     ? 'bg-blue-500' : 'bg-slate-300'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent activities */}
            <div className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-foreground">Recent Activities</h3>
                <button onClick={() => setActiveTab('audit')} className="text-xs text-slate-600 hover:underline">
                  View Full Audit →
                </button>
              </div>
              <div className="space-y-3">
                {auditLog.slice(0, 5).map((a, i) => (
                  <div key={i} className="flex items-start justify-between p-3 bg-muted rounded border border-primary/10">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                        a.result === 'success' ? 'bg-green-400' :
                        a.result === 'failure' ? 'bg-red-400' : 'bg-yellow-400'
                      }`} />
                      <div>
                        <p className="font-semibold text-sm font-mono text-foreground">{a.action}</p>
                        <p className="text-xs text-muted-foreground">{a.user} · {a.resource}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono shrink-0 ml-4">{a.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            USERS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Header row */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-2xl font-bold text-foreground">User Management</h2>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => exportUsers('excel')}>↓ Export Excel</Button>
                <Button variant="outline" size="sm" onClick={() => exportUsers('pdf')}>↓ Export PDF</Button>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>↑ Import CSV</Button>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
                <Button className="bg-slate-800 text-white hover:bg-slate-700" size="sm">+ Add User</Button>
              </div>
            </div>

            {/* Filters */}
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
              Showing {filteredUsers.length} of {users.length} users
            </p>

            {/* Table */}
            <div className="bg-card border border-primary/20 rounded-lg overflow-x-auto">
              <table className="w-full min-w-[950px]">
                <thead className="border-b border-primary/20 bg-muted">
                  <tr>
                    {['Name','Email','Role','Status','Verified','Last Active','Sessions','Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {paginatedUsers.map((u, idx) => (
                    <motion.tr key={u.id}
                      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-5 py-3 text-sm text-foreground font-medium">{u.name}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground font-mono">{u.email}</td>
                      <td className="px-5 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                          u.role === 'Administrator' ? 'bg-purple-500/20 text-purple-400' :
                          u.role === 'Organizer'     ? 'bg-blue-500/20   text-blue-400'   :
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
                        ) : u.role === 'Organizer' ? (
                          <button onClick={() => verifyOrganizer(u.id)}
                            className="text-xs bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded hover:bg-slate-200 transition-colors">
                            Verify →
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground font-mono">{u.lastActive}</td>
                      <td className="px-5 py-3 text-sm text-center">
                        <span className={`font-mono ${u.sessions > 0 ? 'text-slate-700' : 'text-muted-foreground'}`}>
                          {u.sessions}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(u)} className="text-slate-700 hover:text-slate-600 font-mono text-xs">Edit</button>
                          {u.status !== 'suspended' ? (
                            <button onClick={() => toggleStatus(u.id, 'suspended')} className="text-red-400 hover:text-red-300 font-mono text-xs">Suspend</button>
                          ) : (
                            <button onClick={() => toggleStatus(u.id, 'active')}    className="text-green-400 hover:text-green-300 font-mono text-xs">Restore</button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground text-sm">No users match your filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination page={usersPage} totalItems={filteredUsers.length} pageSize={PAGE_SIZE} onPageChange={setUsersPage} />

            {/* ── Edit / Role-Assignment Modal ── */}
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

                    {/* Fields */}
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Full Name</label>
                        <Input value={editingUser.name || ''} onChange={e => setEditingUser(p => ({ ...p, name: e.target.value }))}
                          className="border-primary/20 bg-background text-foreground" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Email</label>
                        <Input value={editingUser.email || ''} onChange={e => setEditingUser(p => ({ ...p, email: e.target.value }))}
                          className="border-primary/20 bg-background text-foreground" />
                      </div>

                      {/* Role assignment */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Role Assignment</label>
                        <div className="grid grid-cols-3 gap-2">
                          {ROLES.map(r => (
                            <button key={r} type="button"
                              onClick={() => setEditingUser(p => ({ ...p, role: r }))}
                              className={`p-2 rounded border-2 text-xs font-semibold transition-all ${
                                editingUser.role === r
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-primary/20 text-muted-foreground hover:border-primary/40'
                              }`}
                            >{r}</button>
                          ))}
                        </div>
                      </div>

                      {/* Status management */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Account Status</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['active','inactive','pending','suspended'] as MockUser['status'][]).map(s => (
                            <button key={s} type="button"
                              onClick={() => setEditingUser(p => ({ ...p, status: s }))}
                              className={`p-2 rounded border-2 text-xs font-semibold capitalize transition-all ${
                                editingUser.status === s
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-primary/20 text-muted-foreground hover:border-primary/40'
                              }`}
                            >{s}</button>
                          ))}
                        </div>
                      </div>

                      {/* Permission preview */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                          Permissions Preview — {editingUser.role}
                        </label>
                        <div className="bg-muted/50 rounded-lg p-3 space-y-1 max-h-36 overflow-y-auto">
                          {PERMISSIONS.map(p => {
                            const has = permMatrix[editingUser.role || '']?.has(p.id);
                            return (
                              <div key={p.id} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{p.label}</span>
                                <span className={has ? 'text-green-400' : 'text-muted-foreground/40'}>
                                  {has ? <IconCheck size={14} stroke={2} /> : <IconX size={14} stroke={2} />}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Adjust in the{' '}
                          <button type="button" onClick={() => { setShowModal(false); setActiveTab('permissions'); }}
                            className="text-slate-600 hover:underline">Permissions tab</button>
                        </p>
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
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Draw Management</h2>
              <Button className="bg-slate-800 text-white hover:bg-slate-700">Create Draw</Button>
            </div>
            <Input placeholder="Search draws by name…" value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="border-primary/20 bg-background text-foreground" />
            <div className="grid gap-4">
              {paginatedDraws.map((draw, idx) => (
                <motion.div key={draw.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-card border border-primary/20 rounded-lg p-6 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{draw.title || draw.name || 'Untitled Draw'}</h3>
                      <p className="text-sm text-muted-foreground">ID: <span className="font-mono text-slate-700">{draw.id}</span></p>
                    </div>
                    <span className={`px-3 py-1 rounded text-xs font-mono font-bold ${
                      draw.status === 'open' || draw.status === 'active'
                        ? 'bg-green-500/10 text-green-700'
                        : draw.status === 'completed'
                          ? 'bg-slate-100 text-slate-700 border border-slate-300'
                          : 'bg-muted text-muted-foreground border border-primary/20'
                    }`}>{draw.status?.toUpperCase() || 'DRAFT'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Max Entries</p>
                      <p className="text-2xl font-bold text-primary">{draw.max_entries || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Created</p>
                      <p className="text-sm text-foreground">{draw.created_at ? new Date(draw.created_at).toLocaleDateString() : '—'}</p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline">View</Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <Pagination page={drawsPage} totalItems={filteredDraws.length} pageSize={PAGE_SIZE} onPageChange={setDrawsPage} />
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            SECURITY
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'security' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">Security Settings</h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Session policy */}
              <div className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
                <h3 className="font-bold text-foreground">Session Policy</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Session Timeout',    sub: 'Auto logout after inactivity',  val: '30 min', green: false },
                    { label: 'Max Active Sessions', sub: 'Per organizer account',         val: '5',      green: false },
                    { label: '2FA Required',        sub: 'For organizers & admins',       val: 'ON',     green: true  },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted rounded">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.sub}</p>
                      </div>
                      <span className={`font-mono text-sm font-bold ${item.green ? 'text-green-400' : 'text-slate-700'}`}>{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data protection */}
              <div className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
                <h3 className="font-bold text-foreground">Data Protection</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Encryption',    sub: 'AES-256 at rest' },
                    { label: 'HTTPS',         sub: 'TLS 1.3'         },
                    { label: 'Audit Logging', sub: 'All activities tracked' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted rounded">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.sub}</p>
                      </div>
                      <span className="text-green-400 font-mono text-sm font-bold"><IconCheck size={16} stroke={2} /></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Active Sessions Overview ── */}
            <div className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground">Session Management Overview</h3>
                <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                  {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-primary/20">
                      {['User','Device','IP Address','Location','Started','Last Active',''].map((h, i) => (
                        <th key={i} className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/10">
                    {sessions.map(s => (
                      <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{s.userName}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{s.device}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{s.ip}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{s.location}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{s.startedAt}</td>
                        <td className="px-4 py-3 text-xs text-slate-700 font-mono">{s.lastActivity}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => revokeSession(s.id)}
                            className="text-xs text-red-400 hover:text-red-300 font-mono border border-red-500/20 px-2 py-0.5 rounded transition-colors">
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sessions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">
                          No active sessions
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Alerts */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 space-y-3">
              <h3 className="font-bold text-yellow-400">Security Alerts</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>• No suspicious login attempts in the past 7 days</li>
                <li>• All organizers have 2FA enabled</li>
                <li>• API rate limiting active</li>
                <li>• DDoS protection enabled</li>
              </ul>
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            AUDIT TRAIL
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'audit' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-bold text-foreground">User Audit Trail</h2>
                <p className="text-sm text-muted-foreground mt-1">Complete log of all user and system actions</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => exportAudit('excel')}>↓ Export Audit (Excel)</Button>
              <Button variant="outline" size="sm" onClick={() => exportAudit('pdf')}>↓ Export Audit (PDF)</Button>
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <Input
                placeholder="Search by user, action, resource…"
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                className="border-primary/20 bg-background text-foreground flex-1 min-w-[200px]"
              />
              <select value={auditResult} onChange={e => setAuditResult(e.target.value as any)}
                className="border border-primary/20 bg-background text-foreground rounded px-3 py-2 text-sm"
              >
                <option value="all">All Results</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
                <option value="warning">Warning</option>
              </select>
            </div>

            <p className="text-xs text-muted-foreground">{filteredAudit.length} events found</p>

            {/* Table */}
            <div className="bg-card border border-primary/20 rounded-lg overflow-x-auto">
              <table className="w-full min-w-[750px]">
                <thead className="border-b border-primary/20 bg-muted">
                  <tr>
                    {['Timestamp','User','Action','Resource','IP Address','Result'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {paginatedAudit.map((a, i) => (
                    <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.025 }}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-5 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">{a.timestamp}</td>
                      <td className="px-5 py-3 text-sm text-foreground font-mono">{a.user}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-mono bg-primary/10 text-foreground px-2 py-0.5 rounded">{a.action}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground font-mono">{a.resource}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground font-mono">{a.ip}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${resultStyles[a.result]}`}>
                          {a.result.toUpperCase()}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                  {filteredAudit.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground text-sm">No audit entries match your filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={auditPage} totalItems={filteredAudit.length} pageSize={PAGE_SIZE} onPageChange={setAuditPage} />
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            ACCESS REQUESTS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'requests' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Access Request Workflow</h2>
              <p className="text-sm text-muted-foreground mt-1">Review and approve organizer registration requests</p>
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 flex-wrap">
              {(['all','pending','approved','rejected'] as const).map(f => (
                <button key={f} onClick={() => setReqFilter(f)}
                  className={`px-4 py-2 rounded-full text-sm font-mono font-semibold transition-all ${
                    reqFilter === f
                      ? 'bg-slate-800 text-white'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === 'pending' && pendingCount > 0 && (
                    <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {paginatedRequests.map((req, idx) => (
                <motion.div key={req.id}
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`bg-card border rounded-lg p-6 space-y-4 ${
                    req.status === 'pending'  ? 'border-yellow-500/30' :
                    req.status === 'approved' ? 'border-green-500/30'  : 'border-red-500/30'
                  }`}
                >
                  {/* Request header */}
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-foreground">{req.name}</h3>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                          req.status === 'pending'  ? 'bg-yellow-500/20 text-yellow-400' :
                          req.status === 'approved' ? 'bg-green-500/20  text-green-400'  :
                                                      'bg-red-500/20    text-red-400'
                        }`}>{req.status.toUpperCase()}</span>
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">{req.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{req.submittedAt}</span>
                  </div>

                  {/* Details grid */}
                  <div className="grid sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Company</p>
                      <p className="text-foreground font-medium">{req.company}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">License No.</p>
                      <p className="text-foreground font-mono text-xs">{req.license}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Requested Role</p>
                      <p className="text-foreground capitalize">{req.role}</p>
                    </div>
                  </div>

                  {/* Existing notes */}
                  {req.notes && (
                    <div className="bg-muted/50 rounded p-3 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">Note: </span>{req.notes}
                    </div>
                  )}

                  {/* Action panel — pending only */}
                  {req.status === 'pending' && (
                    <div className="space-y-3 pt-3 border-t border-primary/10">
                      <Input
                        placeholder="Add a review note (optional)…"
                        value={requestNotes[req.id] || ''}
                        onChange={e => setRequestNotes(p => ({ ...p, [req.id]: e.target.value }))}
                        className="border-primary/20 bg-background text-foreground text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white flex-1"
                          onClick={() => handleRequest(req.id, 'approved')}
                        >
                          <IconCheck size={14} stroke={2} /> Approve
                        </Button>
                        <Button size="sm" variant="outline"
                          className="border-red-500/40 text-red-400 hover:bg-red-500/10 flex-1"
                          onClick={() => handleRequest(req.id, 'rejected')}
                        >
                          <IconX size={14} stroke={2} /> Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}

              {filteredRequests.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <IconMail className="mx-auto mb-3 text-muted-foreground" size={40} stroke={1} />
                  <p>No {reqFilter === 'all' ? '' : reqFilter} requests found.</p>
                </div>
              )}
            </div>
            <Pagination page={requestsPage} totalItems={filteredRequests.length} pageSize={PAGE_SIZE} onPageChange={setRequestsPage} />
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            PERMISSIONS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'permissions' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Permission Matrix Editor</h2>
                <p className="text-sm text-muted-foreground mt-1">Configure role-based access control for every user type</p>
              </div>
              <div className="flex items-center gap-3">
                <AnimatePresence>
                  {permSaved && (
                    <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="text-green-400 text-sm font-mono">
                      <IconCheck size={14} stroke={2} /> Saved!
                    </motion.span>
                  )}
                </AnimatePresence>
                <Button className="bg-slate-800 text-white hover:bg-slate-700" onClick={savePerms}>
                  Save Changes
                </Button>
              </div>
            </div>

            {/* Role summary chips */}
            <div className="flex gap-3 flex-wrap">
              {ROLES.map(role => (
                <div key={role} className="bg-card border border-primary/20 rounded-lg px-4 py-2 flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    role === 'Administrator' ? 'bg-purple-500' :
                    role === 'Organizer'     ? 'bg-blue-500'   : 'bg-slate-300'
                  }`} />
                  <span className="text-sm font-medium text-foreground">{role}</span>
                  <span className="text-xs text-muted-foreground font-mono ml-1">
                    {permMatrix[role]?.size ?? 0} / {PERMISSIONS.length}
                  </span>
                </div>
              ))}
            </div>

            {/* Matrix table */}
            <div className="bg-card border border-primary/20 rounded-lg overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="border-b border-primary/20 bg-muted">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground w-1/2">Permission</th>
                    {ROLES.map(role => (
                      <th key={role} className="px-6 py-4 text-center text-sm font-semibold text-foreground">
                        <span className={`${
                          role === 'Administrator' ? 'text-purple-400' :
                          role === 'Organizer'     ? 'text-blue-400'   : 'text-foreground'
                        }`}>{role}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERM_CATEGORIES.map(cat => (
                    <Fragment key={cat}>
                      {/* Category header row */}
                      <tr className="bg-primary/5 border-t border-primary/10">
                        <td colSpan={ROLES.length + 1} className="px-6 py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          {cat}
                        </td>
                      </tr>
                      {/* Permission rows */}
                      {PERMISSIONS.filter(p => p.category === cat).map(perm => (
                        <tr key={perm.id} className="border-t border-primary/10 hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-3 text-sm text-foreground">{perm.label}</td>
                          {ROLES.map(role => {
                            const has    = permMatrix[role]?.has(perm.id) ?? false;
                            const locked = role === 'Administrator';
                            return (
                              <td key={role} className="px-6 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={has}
                                  disabled={locked}
                                  onChange={() => togglePerm(role, perm.id)}
                                  className="w-4 h-4 accent-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Note: </span>
              Administrator permissions are locked and cannot be reduced. Changes to Organizer and Participant roles take effect immediately after saving and apply to all future sessions.
            </div>
          </motion.div>
        )}

      </div>
    </main>
  </div>
  );
}