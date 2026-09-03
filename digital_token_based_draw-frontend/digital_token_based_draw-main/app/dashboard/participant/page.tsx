'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, apiUrls } from '@/lib/api';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { IconDiamond, IconTicket, IconClock, IconTrophy, IconBell, IconCheck, IconCoin, IconPlus, IconChartBar } from '@tabler/icons-react';

export default function ParticipantDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading, refreshUser } = useAuth();
  const [draws, setDraws] = useState<any[]>([]);
  const [myTokens, setMyTokens] = useState<any[]>([]);
  const [myWins, setMyWins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpPhone, setTopUpPhone] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpMessage, setTopUpMessage] = useState('');
  const [topUpError, setTopUpError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'participant') {
      router.push('/auth');
      return;
    }

    const fetchData = async () => {
      try {
        const [drawsRes, tokensRes] = await Promise.all([
          api<{ success: boolean; data: any[] }>(apiUrls.draws.list),
          api<{ success: boolean; data: any[] }>(apiUrls.tokens.myTokens).catch(() => ({ data: [] })),
        ]);
        setDraws(drawsRes.data || []);
        setMyTokens(tokensRes.data || []);
      } catch {} finally {
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
          <p className="text-muted-foreground font-mono">Loading...</p>
        </main>
      </div>
    );
  }

  if (!user) return null;

  const iconMap: Record<string, React.ComponentType<any>> = {
    diamond: IconDiamond, ticket: IconTicket, clock: IconClock, trophy: IconTrophy, bell: IconBell, wallet: IconCoin,
  };

  const openDraws = draws.filter((d: any) => d.status === 'open');
  const enteredDrawIds = new Set(myTokens.map((t: any) => t.draw_id));
  const enteredCount = draws.filter((d: any) => enteredDrawIds.has(d.id)).length;

  const stats = [
    { label: 'Balance', value: `$${(user?.balance || 0).toFixed(2)}`, icon: 'wallet' },
    { label: 'Draws Available', value: openDraws.length, icon: 'diamond' },
    { label: 'My Tokens', value: myTokens.filter((t: any) => t.status === 'issued').length, icon: 'ticket' },
    { label: 'Draws Entered', value: enteredCount, icon: 'clock' },
    { label: 'My Wins', value: myWins.length, icon: 'trophy' },
  ];

  const tokenChartData = [
    { name: 'Available', value: myTokens.filter((t: any) => t.status === 'issued').length },
    { name: 'Used', value: myTokens.filter((t: any) => t.status === 'used').length },
  ];
  const totalTokenValue = tokenChartData[0].value + tokenChartData[1].value;

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0) { setTopUpError('Enter a valid amount'); return; }
    setTopUpLoading(true);
    setTopUpError('');
    setTopUpMessage('');
    try {
      const res = await api<{ success: boolean; data: any }>(apiUrls.auth.topup, {
        method: 'POST',
        body: JSON.stringify({ amount, phone: topUpPhone }),
      });
      if (res.success) {
        await refreshUser();
        setTopUpMessage(`$${amount.toFixed(2)} added to your balance`);
        setTopUpAmount('');
        setTopUpPhone('');
      }
    } catch (err: any) {
      setTopUpError(err.message);
    }
    setTopUpLoading(false);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">Welcome back, {user?.name}!</h1>
            <p className="text-muted-foreground">Explore draws and manage your entries.</p>
          </motion.div>

          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {stats.map((stat, idx) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-card border border-primary/20 rounded-lg p-4 space-y-2 hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">{stat.label}</p>
                  <span className="text-xl text-muted-foreground">{(() => { const Ic = iconMap[stat.icon]; return Ic ? <Ic size={20} stroke={1.5} /> : null; })()}</span>
                </div>
                <p className="text-3xl font-bold text-slate-700">{stat.value}</p>
                {stat.label === 'Balance' && (
                  <Button onClick={() => setShowTopUp(true)} size="sm" className="w-full mt-1 bg-[#3BB82E] text-white hover:bg-[#288C1D] active:scale-95">
                    <IconPlus size={14} stroke={2} /> Top Up
                  </Button>
                )}
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-primary/20 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-foreground">My Tokens</h2>
                <span className="text-xs text-muted-foreground font-mono">{totalTokenValue} total</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tokenChartData}>
                    <defs>
                      <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3BB82E" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#3BB82E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,46,0.15)" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#3BB82E" strokeWidth={2} fill="url(#tokenGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4 text-center">
                <div className="bg-primary/5 border border-primary/20 rounded-lg py-3">
                  <p className="text-2xl font-bold text-[#3BB82E]">{tokenChartData[0].value}</p>
                  <p className="text-xs text-muted-foreground">Available</p>
                </div>
                <div className="bg-muted/40 border border-primary/10 rounded-lg py-3">
                  <p className="text-2xl font-bold text-muted-foreground">{tokenChartData[1].value}</p>
                  <p className="text-xs text-muted-foreground">Used</p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-primary/20 rounded-lg p-6">
              <h2 className="font-bold text-foreground mb-4">Participation Overview</h2>
              <div className="space-y-5">
                {[
                  { label: 'Draws Available', value: openDraws.length, color: '#3BB82E' },
                  { label: 'Draws Entered', value: enteredCount, color: '#22c55e' },
                  { label: 'My Wins', value: myWins.length, color: '#f5c200' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-bold text-foreground">{item.value}</span>
                    </div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((item.value / (openDraws.length || 1)) * 100, 100)}%` }}
                        transition={{ delay: 0.4, duration: 0.8 }}
                        className="h-full rounded-full" style={{ background: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Open Draws</h2>
              <Button onClick={() => router.push('/dashboard/participant/draws')}
                className="bg-[#3BB82E] text-white hover:bg-[#288C1D] active:scale-95">View All</Button>
            </div>
            <div className="space-y-3">
              {openDraws.slice(0, 3).map((draw: any, idx: number) => (
                <motion.div key={draw.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + idx * 0.05 }}
                  onClick={() => router.push('/dashboard/participant/draws')}
                  className="p-4 bg-background border border-primary/20 rounded-lg hover:border-primary/40 cursor-pointer transition-all duration-300 group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground group-hover:text-slate-700 transition-colors">{draw.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">by {draw.organizer_name}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${enteredDrawIds.has(draw.id) ? 'bg-primary/20 text-primary' : 'bg-slate-100 text-slate-700'}`}>
                      {enteredDrawIds.has(draw.id) ? (<><IconCheck size={12} stroke={2} /> Entered</>) : 'Open'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><p className="text-muted-foreground text-xs mb-1">Entries</p><p className="text-primary font-bold text-sm">{draw.entry_count || 0}</p></div>
                    <div><p className="text-muted-foreground text-xs mb-1">Winners</p><p className="text-slate-700 font-bold">{draw.winners_count || 0}</p></div>
                    <div><p className="text-muted-foreground text-xs mb-1">Draw Date</p><p className="text-foreground font-bold text-sm">{new Date(draw.draw_date).toLocaleDateString()}</p></div>
                  </div>
                </motion.div>
              ))}
              {openDraws.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No open draws available right now.</p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'My Tokens', href: '/dashboard/participant/entries', icon: 'ticket' },
              { label: 'View Results', href: '/dashboard/participant/results', icon: 'trophy' },
              { label: 'Notifications', href: '/dashboard/participant/notifications', icon: 'bell' },
            ].map(action => (
              <Button key={action.label} onClick={() => router.push(action.href)} variant="outline"
                className="h-24 border-primary/20 bg-card hover:bg-primary/5 hover:border-primary/40 flex flex-col items-center justify-center gap-2">
                <span className="text-2xl">{(() => { const Ic = iconMap[action.icon]; return Ic ? <Ic size={24} stroke={1.5} /> : null; })()}</span>
                <span className="text-center text-sm">{action.label}</span>
              </Button>
            ))}
          </motion.div>
        </div>
      </main>

      {/* Top Up Modal */}
      <AnimatePresence>
        {showTopUp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowTopUp(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-primary/20 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Top Up Balance</h2>
                <button onClick={() => setShowTopUp(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
              </div>

              {topUpMessage && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-600 text-center">{topUpMessage}</div>
              )}
              {topUpError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-600 text-center">{topUpError}</div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Amount ($)</label>
                  <Input type="number" min="1" step="0.01" placeholder="e.g. 50.00"
                    value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)}
                    className="border-primary/20 bg-background text-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Phone Number</label>
                  <Input type="tel" placeholder="+1 555 000 0000"
                    value={topUpPhone} onChange={e => setTopUpPhone(e.target.value)}
                    className="border-primary/20 bg-background text-foreground" />
                  <p className="text-xs text-muted-foreground mt-1">Used for payment reference (no actual charge)</p>
                </div>
              </div>

              <Button onClick={handleTopUp} disabled={topUpLoading || !topUpAmount.trim()}
                className="w-full bg-[#3BB82E] text-white hover:bg-[#288C1D] active:scale-95">
                {topUpLoading ? 'Processing...' : `Top Up $${parseFloat(topUpAmount) || 0}`}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
