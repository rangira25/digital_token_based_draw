'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, apiUrls } from '@/lib/api';
import { IconCopy, IconCheck, IconTicket, IconClock, IconCircleX, IconCircleCheck, IconSearch } from '@tabler/icons-react';
import { Pagination } from '@/components/Pagination';

interface MyToken {
  id: string;
  tokenCode: string;
  drawId: string;
  drawName: string;
  status: 'issued' | 'used' | 'expired' | 'revoked';
  issuedAt: string;
  usedAt?: string;
  expiresAt?: string;
  weight: number;
}

type StatusFilter = 'all' | 'issued' | 'used' | 'expired' | 'revoked';

export default function MyTokensPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [tokens, setTokens] = useState<MyToken[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'participant') { router.push('/auth'); return; }
    const fetchTokens = async () => {
      try {
        const res = await api<{ success: boolean; data: any[] }>(apiUrls.tokens.myTokens);
        const mapped: MyToken[] = (res.data || []).map((t: any) => ({
          id: t.id,
          tokenCode: t.token_code,
          drawId: t.draw_id,
          drawName: t.draw_title || 'Unknown Draw',
          status: t.status,
          issuedAt: t.issued_at?.split('T')[0] || '',
          usedAt: t.used_at?.split('T')[0] || undefined,
          expiresAt: t.expires_at?.split('T')[0] || undefined,
          weight: t.weight || 1,
        }));
        setTokens(mapped);
      } catch {
        setTokens([]);
      }
      setLoading(false);
    };
    fetchTokens();
  }, [user, isLoading, router]);

  useEffect(() => { setPage(1); }, [filter, search]);

  const filtered = useMemo(() => tokens.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false;
    const q = search.toLowerCase();
    return !q || t.tokenCode.toLowerCase().includes(q) || t.drawName.toLowerCase().includes(q);
  }), [tokens, filter, search]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => ({
    total: tokens.length,
    issued: tokens.filter(t => t.status === 'issued').length,
    used: tokens.filter(t => t.status === 'used').length,
    expired: tokens.filter(t => t.status === 'expired').length,
    revoked: tokens.filter(t => t.status === 'revoked').length,
  }), [tokens]);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    issued:  { color: 'bg-green-500/10 text-green-600 border-green-500/30', icon: <IconTicket size={14} /> },
    used:    { color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', icon: <IconCircleCheck size={14} /> },
    expired: { color: 'bg-red-500/10 text-red-500 border-red-500/30', icon: <IconClock size={14} /> },
    revoked: { color: 'bg-gray-500/10 text-gray-400 border-gray-500/30', icon: <IconCircleX size={14} /> },
  };

  if (isLoading || loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <p className="text-muted-foreground">Loading your tokens...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">My Tokens</h1>
            <p className="text-muted-foreground">View and manage all your draw tokens in one place.</p>
          </motion.div>

          {/* Stats */}
          <motion.div className="grid grid-cols-2 md:grid-cols-5 gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            {[
              { label: 'Total', value: stats.total, color: 'text-foreground' },
              { label: 'Available', value: stats.issued, color: 'text-green-600' },
              { label: 'Used', value: stats.used, color: 'text-blue-500' },
              { label: 'Expired', value: stats.expired, color: 'text-red-500' },
              { label: 'Revoked', value: stats.revoked, color: 'text-gray-400' },
            ].map(card => (
              <motion.div key={card.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-primary/20 rounded-lg p-4">
                <p className="text-xs text-muted-foreground font-mono uppercase mb-1">{card.label}</p>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Search + Filters */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="space-y-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search by token code or draw name..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-9 border-primary/20 bg-background text-foreground" />
              </div>
              <Button onClick={() => router.push('/dashboard/participant/draws')}
                className="bg-slate-800 text-white hover:bg-slate-700">
                Buy Tokens
              </Button>
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
              {(['all', 'issued', 'used', 'expired', 'revoked'] as StatusFilter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                    filter === f ? 'bg-slate-800 text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f !== 'all' && <span className="ml-1 opacity-60">({stats[f]})</span>}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Token List */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-2">
            <AnimatePresence>
              {paginated.map((token, idx) => {
                const sc = statusConfig[token.status] || statusConfig.issued;
                return (
                  <motion.div key={token.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }} transition={{ delay: idx * 0.03 }}
                    className="bg-card border border-primary/20 rounded-lg p-4 hover:border-primary/40 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Token Code */}
                        <div className="flex items-center gap-2 bg-background border border-primary/10 rounded-lg px-3 py-2">
                          <span className="font-mono text-sm font-bold text-foreground">{token.tokenCode}</span>
                          <button onClick={() => handleCopy(token.tokenCode, token.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors">
                            {copiedId === token.id ? <IconCheck size={14} className="text-green-500" /> : <IconCopy size={14} />}
                          </button>
                        </div>
                        {/* Draw Name */}
                        <div className="min-w-0">
                          <p className="text-sm text-foreground font-medium truncate">{token.drawName}</p>
                          <p className="text-xs text-muted-foreground">Issued {token.issuedAt}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {token.expiresAt && (
                          <span className="text-xs text-muted-foreground font-mono hidden md:block">Exp: {token.expiresAt}</span>
                        )}
                        {token.weight > 1 && (
                          <span className="text-xs text-primary font-mono bg-primary/10 border border-primary/30 px-2 py-0.5 rounded">
                            x{token.weight} weight
                          </span>
                        )}
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border ${sc.color}`}>
                          {sc.icon}
                          {token.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filtered.length > 0 && (
              <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            )}

            {filtered.length === 0 && (
              <div className="text-center py-16 bg-card border border-primary/20 rounded-lg">
                <IconTicket size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground mb-4">
                  {tokens.length === 0 ? "You don't have any tokens yet." : "No tokens match your filters."}
                </p>
                <Button onClick={() => router.push('/dashboard/participant/draws')}
                  className="bg-slate-800 text-white hover:bg-slate-700">
                  Browse Draws
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
