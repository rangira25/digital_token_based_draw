'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { api, apiUrls } from '@/lib/api';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { Pagination } from '@/components/Pagination';

export default function EntriesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [entries, setEntries] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (!user || user.role !== 'participant') return;
    const fetchEntries = async () => {
      try {
        const res = await api<{ success: boolean; data: any[] }>(apiUrls.tokens.myEntries);
        const mapped = (res.data || []).map((e: any) => ({
          id: e.id || `entry-${Math.random()}`,
          drawName: e.draw_title || 'Unknown Draw',
          tokens: e.token_code ? [e.token_code] : [],
          status: e.status || 'active',
          enteredDate: e.submitted_at?.split('T')[0] || e.created_at?.split('T')[0] || '',
          winnerRank: e.winner_rank || null,
          winnerStatus: e.winner_status || null,
          prizeId: e.prize_id || null,
        }));
        setEntries(mapped);
      } catch {
        setEntries([]);
      }
    };
    fetchEntries();
  }, [user]);

  if (!user || user.role !== 'participant') {
    router.push('/auth');
    return null;
  }

  const filteredEntries = filter === 'all' 
    ? entries 
    : entries.filter(e => e.status === filter);

  const totalPages = Math.ceil(filteredEntries.length / PAGE_SIZE);
  const paginatedEntries = filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statsCards = [
    { label: 'Total Entries', value: entries.length, color: 'text-slate-700' },
    { label: 'Active Draws', value: entries.filter(e => e.status === 'active').length, color: 'text-[#3BB82E]' },
    { label: 'Tokens', value: entries.reduce((sum: number, e: any) => sum + (e.tokens?.length || 0), 0), color: 'text-[#3BB82E]' },
    { label: 'Expired', value: entries.filter(e => e.status === 'expired').length, color: 'text-red-400' },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-4xl font-bold text-foreground">My Entries</h1>
          <p className="text-muted-foreground">Track all your draw entries and tokens</p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, staggerChildren: 0.05 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {statsCards.map((card, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-card border border-primary/20 rounded-lg p-6 space-y-2"
            >
              <p className="text-sm text-muted-foreground font-mono uppercase">{card.label}</p>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Filter Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2 bg-muted rounded-lg p-1 w-fit"
        >
          {(['all', 'active', 'expired'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-4 py-2 rounded font-mono text-sm transition-all active:scale-95 ${
                filter === f
                  ? 'bg-[#3BB82E] text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </motion.div>

        {/* Entries Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid gap-4"
        >
          {paginatedEntries.map((entry, idx) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`border rounded-lg p-6 space-y-4 transition-all duration-300 hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 ${
                idx % 2 === 0
                  ? 'bg-card border-primary/20'
                  : 'bg-primary/5 border-primary/30'
              } ${
                entry.status === 'active' 
                  ? (idx % 2 === 0 ? 'border-slate-300' : 'border-primary/40')
                  : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-foreground">{entry.drawName}</h3>
                  <p className="text-sm text-muted-foreground">Entry ID: <span className="font-mono text-slate-700">{entry.id}</span></p>
                </div>
                <div className="flex gap-2">
                  {entry.winnerRank && (
                    <span className={`px-3 py-1 rounded text-xs font-mono font-bold ${
                      entry.winnerStatus === 'claimed'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-green-500/20 text-green-500 border border-green-500/30'
                    }`}>
                      {entry.winnerStatus === 'claimed' ? 'PRIZE CLAIMED' : `WINNER #${entry.winnerRank}`}
                    </span>
                  )}
                  <span className={`px-3 py-1 rounded text-xs font-mono font-bold ${
                    entry.status === 'active'
                      ? 'bg-slate-100 text-slate-700 border border-slate-300'
                      : 'bg-muted text-muted-foreground border border-primary/20'
                  }`}>
                    {entry.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Entered</p>
                  <p className="font-mono text-foreground">{entry.enteredDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Expires</p>
                  <p className="font-mono text-foreground">{entry.expiryDate}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-mono">ASSIGNED TOKENS ({entry.tokens.length})</p>
                <div className="flex flex-wrap gap-2">
                  {entry.tokens.map((token: string, t: number) => (
                    <span
                      key={t}
                      className="px-3 py-1 bg-primary/10 border border-primary/30 rounded text-xs font-mono text-primary"
                    >
                      {token}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/participant/draws')}>
                  View Draw
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedEntry(entry)}>
                  Token Details
                </Button>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {totalPages > 1 && (
          <Pagination page={page} totalItems={filteredEntries.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        )}

        {filteredEntries.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 space-y-4"
          >
            <p className="text-muted-foreground text-lg">No {filter === 'all' ? '' : filter} entries found</p>
            <Button onClick={() => router.push('/dashboard/participant/draws')} className="bg-[#3BB82E] text-white hover:bg-[#288C1D] active:scale-95">
              Browse Available Draws
            </Button>
          </motion.div>
        )}

        {/* Token Details Modal */}
        <AnimatePresence>
          {selectedEntry && (
            <motion.div
              key="token-detail-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setSelectedEntry(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-card border border-primary/20 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-5"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{selectedEntry.drawName}</h2>
                    <p className="text-xs text-muted-foreground font-mono mt-1">Entry {selectedEntry.id}</p>
                  </div>
                  <button onClick={() => setSelectedEntry(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
                </div>
                <div className="space-y-3">
                  <div className="bg-background border border-primary/10 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-2 font-mono">ASSIGNED TOKENS</p>
                    {selectedEntry.tokens.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No tokens assigned.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedEntry.tokens.map((code: string, i: number) => (
                          <div key={i} className="flex items-center justify-between bg-card border border-primary/10 rounded px-3 py-2">
                            <span className="font-mono text-sm font-bold text-foreground">{code}</span>
                            <button onClick={() => navigator.clipboard.writeText(code)} className="text-xs text-primary hover:text-primary/80">Copy</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-background border border-primary/10 rounded-lg p-3">
                      <p className="text-muted-foreground mb-0.5">Status</p>
                      <span className={`font-bold ${selectedEntry.status === 'active' ? 'text-[#3BB82E]' : 'text-muted-foreground'}`}>
                        {selectedEntry.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="bg-background border border-primary/10 rounded-lg p-3">
                      <p className="text-muted-foreground mb-0.5">Entered</p>
                      <p className="font-bold text-foreground">{selectedEntry.enteredDate}</p>
                    </div>
                  </div>
                  {selectedEntry.winnerRank && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                      <p className="text-green-600 font-bold text-sm">
                        {selectedEntry.winnerStatus === 'claimed' ? 'Prize Claimed' : `Winner #${selectedEntry.winnerRank}`}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  </div>
  );
}
