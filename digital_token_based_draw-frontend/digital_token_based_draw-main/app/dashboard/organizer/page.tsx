'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { Button } from '@/components/ui/button';
import { api, apiUrls, ApiError } from '@/lib/api';
import { IconStar, IconDiamond, IconBolt, IconUsers, IconClipboardList, IconChartBar, IconTrophy } from '@tabler/icons-react';

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

  const a = analytics || {};
  const drawStats = a.draws || {};
  const stats = [
    { label: 'Total Draws', value: drawStats.total_draws || draws.length, icon: 'diamond' },
    { label: 'Active Draws', value: drawStats.active_draws || draws.filter((d: any) => d.status === 'open').length, icon: 'bolt' },
    { label: 'Total Entries', value: a.entries?.total_entries || 0, icon: 'users' },
    { label: 'Active Tokens', value: a.tokens?.active_tokens || 0, icon: 'star' },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8">
          {(() => {
            const iconMap: Record<string, React.ComponentType<any>> = {
              star: IconStar, diamond: IconDiamond, bolt: IconBolt, users: IconUsers,
              clipboard: IconClipboardList, chart: IconChartBar, trophy: IconTrophy,
            };
            return (
              <>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">Organizer Dashboard</h1>
            <p className="text-muted-foreground">Manage your draws, participants, and winners transparently.</p>
          </motion.div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/40 text-destructive text-sm p-3 rounded">{error}</div>
          )}

          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {stats.map((stat, idx) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-card border border-primary/20 rounded-lg p-4 space-y-2 hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">{stat.label}</p>
                  <span className="text-xl">{(() => { const Ic = iconMap[stat.icon]; return Ic ? <Ic size={18} stroke={1.5} /> : null; })()}</span>
                </div>
                <p className="text-3xl font-bold text-primary">{stat.value}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Your Draws</h2>
              <Button onClick={() => router.push('/dashboard/organizer/draws')}
                className="bg-primary text-primary-foreground hover:bg-primary/90">+ New Draw</Button>
            </div>
            <div className="space-y-3">
              {draws.slice(0, 5).map((draw: any, idx: number) => (
                <motion.div key={draw.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.05 }}
                  onClick={() => router.push(`/dashboard/organizer/draws/${draw.id}`)}
                  className="p-4 bg-background border border-primary/20 rounded-lg hover:border-primary/40 cursor-pointer transition-all duration-300 group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <h3 className="font-semibold text-foreground group-hover:text-slate-700 transition-colors">{draw.title}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${draw.status === 'open' ? 'bg-slate-100 text-slate-700' :
                        draw.status === 'completed' ? 'bg-primary/20 text-primary' :
                        draw.status === 'draft' ? 'bg-muted text-muted-foreground' :
                        'bg-yellow-500/20 text-yellow-500'}`}>
                        {draw.status.charAt(0).toUpperCase() + draw.status.slice(1)}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs">{new Date(draw.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><p className="text-muted-foreground text-xs mb-1">Entries</p><p className="text-primary font-bold">{draw.entry_count || 0}</p></div>
                    <div><p className="text-muted-foreground text-xs mb-1">Winners</p>                      <p className="text-primary font-bold">{draw.winners_count || 0}</p></div>
                    <div><p className="text-muted-foreground text-xs mb-1">Status</p><p className="text-foreground font-bold capitalize">{draw.status}</p></div>
                  </div>
                </motion.div>
              ))}
              {draws.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No draws yet. Create your first draw!</p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'View Audit Log', href: '/dashboard/organizer/audit', icon: 'clipboard' },
              { label: 'Analytics Report', href: '/dashboard/organizer/analytics', icon: 'chart' },
              { label: 'Manage Winners', href: '/dashboard/organizer/winners', icon: 'star' },
            ].map(action => (
              <Button key={action.label} onClick={() => router.push(action.href)} variant="outline"
                className="h-24 border-primary/20 bg-card hover:bg-primary/5 hover:border-primary/40 flex flex-col items-center justify-center gap-2">
                <span className="text-2xl">{(() => { const Ic = iconMap[action.icon]; return Ic ? <Ic size={24} stroke={1.5} /> : null; })()}</span>
                <span className="text-center text-sm">{action.label}</span>
              </Button>
            ))}
          </motion.div>
              </>
            );
          })()}
        </div>
      </main>
    </div>
  );
}
