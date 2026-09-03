'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { Button } from '@/components/ui/button';
import { api, apiUrls, ApiError } from '@/lib/api';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { IconStar, IconDiamond, IconBolt, IconUsers, IconClipboardList, IconChartBar, IconTrophy, IconTicket, IconCircleCheck, IconClock } from '@tabler/icons-react';

const DRAW_COLORS = ['#3BB82E', '#288C1D', '#F59E0B', '#8B5CF6', '#0EA5E9', '#F43F5E'];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: 'Active', cls: 'bg-[#3BB82E]/15 text-[#288C1D]' },
  completed: { label: 'Completed', cls: 'bg-[#3BB82E]/20 text-[#288C1D]' },
  draft: { label: 'Draft', cls: 'bg-muted text-muted-foreground' },
  closed: { label: 'Closed', cls: 'bg-amber-500/15 text-amber-600' },
};

export default function OrganizerDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [draws, setDraws] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user || (user.role !== 'organizer' && user.role !== 'admin')) {
      router.push('/auth');
      return;
    }

    const fetchData = async () => {
      try {
        const [drawsRes, analyticsRes] = await Promise.all([
          api<{ success: boolean; data: any[] }>(apiUrls.draws.list),
          api<{ success: boolean; data: any }>(apiUrls.analytics.get),
        ]);
        setDraws(drawsRes.data || []);
        setAnalytics(analyticsRes.data || null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, authLoading, router]);

  const a = analytics || {};
  const drawStats = a.draws || {};

  // Chart datasets (graceful fallbacks)
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {
      Active: drawStats.active_draws ?? draws.filter((d: any) => d.status === 'open').length,
      Completed: drawStats.completed_draws ?? draws.filter((d: any) => d.status === 'completed').length,
      Draft: drawStats.draft_draws ?? draws.filter((d: any) => d.status === 'draft').length,
    };
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [drawStats, draws]);

  const tokensData = useMemo(() => {
    const t = a.tokens || {};
    return [
      { name: 'Active', value: t.active_tokens ?? 0 },
      { name: 'Used', value: t.used_tokens ?? 0 },
      { name: 'Total', value: t.total_tokens ?? 0 },
    ];
  }, [a.tokens]);

  // Entries per draw — built from recentActivity (title + entry_count) or fallback from draws
  const entriesData = useMemo(() => {
    const recent: any[] = a.recentActivity && a.recentActivity.length ? a.recentActivity : draws;
    return recent.slice(0, 6).map((d: any) => ({
      name: (d.title || 'Draw').length > 12 ? (d.title || 'Draw').slice(0, 11) + '…' : (d.title || 'Draw'),
      entries: Number(d.entry_count ?? d.entries ?? 0),
    }));
  }, [a.recentActivity, draws]);

  const tokensSplit = useMemo(() => {
    const t = a.tokens || {};
    const active = t.active_tokens ?? 0;
    const used = t.used_tokens ?? 0;
    return [
      { name: 'Active', value: active },
      { name: 'Used', value: used },
    ];
  }, [a.tokens]);

  const stats = [
    { label: 'Total Draws', value: drawStats.total_draws ?? draws.length, icon: IconDiamond, tint: 'bg-[#3BB82E]/10 text-[#288C1D]' },
    { label: 'Active Draws', value: drawStats.active_draws ?? draws.filter((d: any) => d.status === 'open').length, icon: IconBolt, tint: 'bg-emerald-50 text-emerald-600' },
    { label: 'Total Entries', value: a.entries?.total_entries ?? 0, icon: IconUsers, tint: 'bg-violet-50 text-violet-600' },
    { label: 'Active Tokens', value: a.tokens?.active_tokens ?? 0, icon: IconTicket, tint: 'bg-sky-50 text-sky-600' },
  ];

  if (authLoading || loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <p className="text-muted-foreground font-mono">Loading dashboard...</p>
        </main>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto bg-gradient-to-b from-white to-[#f2f9f1]/60">
        <div className="p-8 space-y-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">Organizer Dashboard</h1>
            <p className="text-muted-foreground">Manage your draws, participants, and winners transparently.</p>
          </motion.div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/40 text-destructive text-sm p-3 rounded">{error}</div>
          )}

          {/* ── Stat cards ── */}
          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {stats.map((stat, idx) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="bg-card border border-primary/15 rounded-xl p-5 space-y-3 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden relative">
                <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-[#3BB82E]/5" />
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">{stat.label}</p>
                  <span className={`w-9 h-9 rounded-lg ${stat.tint} flex items-center justify-center`}>
                    <stat.icon size={18} stroke={1.6} />
                  </span>
                </div>
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* ── Charts row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Entries per draw (area) */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="lg:col-span-2 bg-card border border-primary/15 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <IconChartBar size={18} stroke={1.6} className="text-[#288C1D]" /> Entries Per Draw
                </h2>
                <span className="text-xs text-muted-foreground">Latest activity</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={entriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gEntries" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3BB82E" stopOpacity={0.55} />
                        <stop offset="95%" stopColor="#3BB82E" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                    <Area type="monotone" dataKey="entries" stroke="#3BB82E" strokeWidth={2.5} fill="url(#gEntries)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Draw status donut */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-card border border-primary/15 rounded-xl p-6 space-y-4 flex flex-col">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <IconCircleCheck size={18} stroke={1.6} className="text-[#288C1D]" /> Draw Status
              </h2>
              <div className="flex-1 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={3} strokeWidth={2}>
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={DRAW_COLORS[i % DRAW_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* ── Tokens bar + Your Draws ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Tokens bar chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="bg-card border border-primary/15 rounded-xl p-6 space-y-4 flex flex-col">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <IconTicket size={18} stroke={1.6} className="text-[#288C1D]" /> Token Distribution
              </h2>
              <div className="flex-1 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tokensSplit} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {tokensSplit.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? '#3BB82E' : '#93c96b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Your Draws */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="lg:col-span-2 bg-card border border-primary/15 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">Your Draws</h2>
                <Button onClick={() => router.push('/dashboard/organizer/draws')}
                  className="bg-[#3BB82E] text-white hover:bg-[#288C1D] rounded-full">+ New Draw</Button>
              </div>
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {draws.slice(0, 6).map((draw: any, idx: number) => {
                  const meta = STATUS_META[draw.status] || { label: draw.status, cls: 'bg-muted text-muted-foreground' };
                  return (
                    <motion.div key={draw.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + idx * 0.05 }}
                      onClick={() => router.push(`/dashboard/organizer/draws/${draw.id}`)}
                      className="p-4 bg-background border border-primary/15 rounded-xl hover:border-primary/40 cursor-pointer transition-all duration-300 group flex items-center gap-4">
                      <div className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center ${
                        draw.status === 'open' ? 'bg-[#3BB82E]/15 text-[#288C1D]'
                        : draw.status === 'completed' ? 'bg-violet-50 text-violet-600'
                        : draw.status === 'draft' ? 'bg-slate-100 text-slate-500'
                        : 'bg-amber-50 text-amber-600'}`}>
                        {draw.status === 'open' ? <IconBolt size={20} stroke={1.6} />
                          : draw.status === 'completed' ? <IconTrophy size={20} stroke={1.6} />
                          : draw.status === 'draft' ? <IconClock size={20} stroke={1.6} />
                          : <IconBolt size={20} stroke={1.6} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate group-hover:text-slate-700 transition-colors">{draw.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div><p className="text-muted-foreground text-xs mb-0.5">Entries</p><p className="text-primary font-bold">{draw.entry_count || draw.entries || 0}</p></div>
                          <div><p className="text-muted-foreground text-xs mb-0.5">Winners</p><p className="text-foreground font-bold">{draw.winners_count || 0}</p></div>
                          <div><p className="text-muted-foreground text-xs mb-0.5">Created</p><p className="text-foreground font-medium text-sm">{new Date(draw.created_at).toLocaleDateString()}</p></div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {draws.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No draws yet. Create your first draw!</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* ── Quick actions ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'View Audit Log', href: '/dashboard/organizer/audit', icon: IconClipboardList, tint: 'bg-[#3BB82E]/10 text-[#288C1D]' },
              { label: 'Analytics Report', href: '/dashboard/organizer/analytics', icon: IconChartBar, tint: 'bg-violet-50 text-violet-600' },
              { label: 'Manage Winners', href: '/dashboard/organizer/winners', icon: IconStar, tint: 'bg-amber-50 text-amber-600' },
            ].map(action => (
              <Button key={action.label} onClick={() => router.push(action.href)} variant="outline"
                className="h-24 border-primary/15 bg-card hover:bg-[#3BB82E]/5 hover:border-primary/30 flex flex-col items-center justify-center gap-2">
                <span className={`w-10 h-10 rounded-lg ${action.tint} flex items-center justify-center`}>
                  <action.icon size={20} stroke={1.6} />
                </span>
                <span className="text-center text-sm">{action.label}</span>
              </Button>
            ))}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
