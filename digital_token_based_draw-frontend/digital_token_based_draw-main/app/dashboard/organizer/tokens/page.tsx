'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/Pagination';
import { api, apiUrls } from '@/lib/api';
import { exportExcel, exportPDF, type ExportColumn } from '@/lib/export';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { IconCheck, IconCircleCheck, IconX } from '@tabler/icons-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TokenFormat = 'numeric' | 'alphanumeric';
type TokenStatus = 'active' | 'used' | 'expired' | 'revoked';
type ModalView = 'generate' | 'validate' | 'history' | null;

interface Token {
  id: string;
  tokenCode: string;
  drawId: string;
  drawName: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  format: TokenFormat;
  status: TokenStatus;
  createdDate: string;
  usedDate?: string;
  expiryDate: string;
  regeneratedFrom?: string;
}

// ─── Token Generator ──────────────────────────────────────────────────────────

function generateNumeric(len = 8): string {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');
}

function generateAlphanumeric(len = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateToken(format: TokenFormat, existingIds: Set<string>): string {
  let id: string;
  let attempts = 0;
  do {
    const raw = format === 'numeric' ? generateNumeric() : generateAlphanumeric();
    id = `TK-${raw}`;
    attempts++;
    if (attempts > 1000) throw new Error('Could not generate unique token');
  } while (existingIds.has(id));
  return id;
}

// ─── Types for API data ───────────────────────────────────────────────────

interface ApiDraw { id: string; title: string; }
interface ApiToken { id: string; token_code: string; draw_id: string; participant_id: string; status: string; created_at: string; expires_at: string; used_at?: string; weight: number; draws?: { title: string }; participant_name?: string; participant_email?: string; }

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TokenStatus }) {
  const styles: Record<TokenStatus, string> = {
    active:  'bg-green-500/20 text-green-400 border-green-500/30',
    used:    'bg-blue-500/20  text-blue-400  border-blue-500/30',
    expired: 'bg-red-500/20   text-red-400   border-red-500/30',
    revoked: 'bg-gray-500/20  text-gray-400  border-gray-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${styles[status]}`}>
      {status.toUpperCase()}
    </span>
  );
}

function FormatBadge({ format }: { format: TokenFormat }) {
  const styles: Record<TokenFormat, string> = {
    numeric:      'bg-slate-100 text-slate-700 border-slate-200',
    alphanumeric: 'bg-primary/20 text-primary border-primary/30',
  };
  const icons: Record<TokenFormat, string> = { numeric: '#', alphanumeric: 'Aa' };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono border ${styles[format]}`}>
      {icons[format]} {format}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TokensPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // ── 1. ALL useState ───────────────────────────────────────────────────────
  const [tokens, setTokens]                   = useState<Token[]>([]);
  const [draws, setDraws]                     = useState<ApiDraw[]>([]);
  const [page, setPage]                       = useState(1);
  const PAGE_SIZE = 10;
  const [filter, setFilter]                   = useState<'all' | TokenStatus>('all');
  const [formatFilter, setFormatFilter]       = useState<'all' | TokenFormat>('all');
  const [searchTerm, setSearchTerm]           = useState('');
  const [modal, setModal]                     = useState<ModalView>(null);
  const [selectedToken, setSelectedToken]     = useState<Token | null>(null);
  const [validateInput, setValidateInput]     = useState('');
  const [validateResult, setValidateResult]   = useState<'valid' | 'invalid' | 'used' | 'expired' | null>(null);
  const [genDrawId, setGenDrawId]             = useState('');
  const [genParticipantId, setGenParticipantId] = useState('');
  const [genFormat, setGenFormat]             = useState<TokenFormat>('numeric');
  const [genCount, setGenCount]               = useState('5');
  const [genExpiry, setGenExpiry]             = useState('30');
  const [genPreview, setGenPreview]           = useState<string[]>([]);
  const [genSuccess, setGenSuccess]           = useState(false);
  const [participants, setParticipants]       = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [apiError, setApiError]               = useState('');

  // ── 2. ALL useEffect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    if (!user || (user.role !== 'organizer' && user.role !== 'admin')) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

  // Fetch draws, tokens, and participants from API
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const drawsRes = await api<{ success: boolean; data: any[] }>(apiUrls.draws.list);
        const apiDraws: ApiDraw[] = (drawsRes.data || []).map((d: any) => ({ id: d.id, title: d.title }));
        setDraws(apiDraws);
        if (apiDraws.length > 0 && !genDrawId) setGenDrawId(apiDraws[0].id);

        const allTokens: Token[] = [];
        for (const draw of apiDraws) {
          try {
            const tokensRes = await api<{ success: boolean; data: any[] }>(apiUrls.tokens.drawTokens(draw.id));
            for (const t of tokensRes.data || []) {
              allTokens.push({
                id: t.id,
                tokenCode: t.token_code || t.id,
                drawId: draw.id,
                drawName: draw.title,
                participantId: t.participant_id || '',
                participantName: t.participant_name || 'Unknown',
                participantEmail: t.participant_email || '',
                format: t.token_code?.length > 8 ? 'alphanumeric' : 'numeric' as TokenFormat,
                status: (t.status === 'issued' || t.status === 'active' ? 'active' :
                        t.status === 'used' ? 'used' :
                        t.status === 'expired' ? 'expired' :
                        t.status === 'revoked' ? 'revoked' : 'active') as TokenStatus,
                createdDate: t.issued_at?.split('T')[0] || '',
                usedDate: t.used_at?.split('T')[0] || undefined,
                expiryDate: t.expires_at?.split('T')[0] || '',
              });
            }
          } catch {}
        }
        setTokens(allTokens);

        try {
          const usersRes = await api<{ success: boolean; data: any[] }>(apiUrls.admin.users);
          const participantsList = (usersRes.data || []).filter((u: any) => u.role === 'participant');
          setParticipants(participantsList);
        } catch {}
      } catch {}
    };
    fetchData();
  }, [user]);

  // ── 3. ALL useMemo ────────────────────────────────────────────────────────
  const existingIds = useMemo(() => new Set(tokens.map(t => t.id)), [tokens]);

  const filteredTokens = useMemo(() => tokens.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (formatFilter !== 'all' && t.format !== formatFilter) return false;
    const q = searchTerm.toLowerCase();
    return !q
      || t.tokenCode.toLowerCase().includes(q)
      || t.id.toLowerCase().includes(q)
      || t.participantName.toLowerCase().includes(q)
      || t.drawName.toLowerCase().includes(q)
      || t.participantEmail.toLowerCase().includes(q);
  }), [tokens, filter, formatFilter, searchTerm]);

  useEffect(() => { setPage(1); }, [searchTerm, filter, formatFilter]);

  const paginated = useMemo(() => filteredTokens.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredTokens, page]);

  const stats = useMemo(() => ({
    total:   tokens.length,
    active:  tokens.filter(t => t.status === 'active').length,
    used:    tokens.filter(t => t.status === 'used').length,
    expired: tokens.filter(t => t.status === 'expired').length,
    revoked: tokens.filter(t => t.status === 'revoked').length,
  }), [tokens]);

  // ── 4. ALL useCallback ────────────────────────────────────────────────────
  const handlePreviewGenerate = useCallback(() => {
    const count = Math.min(Math.max(parseInt(genCount) || 1, 1), 1000);
    const tempIds = new Set(existingIds);
    const preview: string[] = [];
    for (let i = 0; i < Math.min(count, 5); i++) {
      const id = generateToken(genFormat, tempIds);
      tempIds.add(id);
      preview.push(id);
    }
    if (count > 5) preview.push(`… and ${count - 5} more`);
    setGenPreview(preview);
  }, [genFormat, genCount, existingIds]);

  const handleConfirmGenerate = useCallback(async () => {
    if (!genDrawId) return;
    setApiError('');
    const count = Math.min(Math.max(parseInt(genCount) || 1, 1), 1000);
    const draw = draws.find(d => d.id === genDrawId);
    if (!draw) return;
    try {
      // Issue tokens to the pool (no participant assignment)
      await api(apiUrls.tokens.issue, {
        method: 'POST',
        body: JSON.stringify({
          draw_id: genDrawId,
          quantity: count,
          weight: 1,
          expires_in_days: parseInt(genExpiry) || 30,
        }),
      });
      // Re-fetch tokens for this draw
      const tokensRes = await api<{ success: boolean; data: any[] }>(apiUrls.tokens.drawTokens(genDrawId));
      const newTokens: Token[] = (tokensRes.data || []).map((t: any) => ({
        id: t.id,
        tokenCode: t.token_code || t.id,
        drawId: draw.id,
        drawName: draw.title,
        participantId: t.participant_id || '',
        participantName: t.participant_name || t.holder_name || 'In Pool',
        participantEmail: t.participant_email || 'Available for claiming',
        format: (t.token_code?.length > 8 ? 'alphanumeric' : 'numeric') as TokenFormat,
        status: (t.status === 'issued' || t.status === 'active' || t.status === 'available' ? 'active' :
                t.status === 'used' ? 'used' :
                t.status === 'expired' ? 'expired' : 'revoked') as TokenStatus,
        createdDate: t.issued_at?.split('T')[0] || '',
        usedDate: t.used_at?.split('T')[0] || undefined,
        expiryDate: t.expires_at?.split('T')[0] || '',
      }));
      setTokens(prev => {
        const filtered = prev.filter(t => t.drawId !== genDrawId);
        return [...newTokens, ...filtered];
      });
      setGenSuccess(true);
      setTimeout(() => {
        setGenSuccess(false);
        setModal(null);
        setGenPreview([]);
      }, 1500);
    } catch (err: any) {
      setApiError(err.message);
    }
  }, [genDrawId, genParticipantId, genFormat, genCount, genExpiry, existingIds, draws, participants]);

  const handleValidate = useCallback(async () => {
    const code = validateInput.trim();
    if (!code) { setValidateResult('invalid'); return; }
    setApiError('');
    try {
      const res = await api<{ success: boolean; data: any }>(apiUrls.tokens.validate(code));
      if (res.data.status === 'used') setValidateResult('used');
      else if (res.data.status === 'expired') setValidateResult('expired');
      else setValidateResult('valid');
    } catch {
      setValidateResult('invalid');
    }
  }, [validateInput]);

  const TOKEN_EXPORT_COLUMNS: ExportColumn[] = [
    { header: 'Token ID', key: 'tokenCode' },
    { header: 'Format', key: 'format' },
    { header: 'Draw', key: 'drawName' },
    { header: 'Participant', key: 'participantName' },
    { header: 'Email', key: 'participantEmail' },
    { header: 'Status', key: 'status' },
    { header: 'Created', key: 'createdDate' },
    { header: 'Expiry', key: 'expiryDate' },
    { header: 'Used Date', key: 'usedDate' },
  ];

  const handleExport = useCallback((fmt: 'excel' | 'pdf') => {
    const base = `tokens-export-${Date.now()}`;
    if (fmt === 'excel') {
      exportExcel(filteredTokens, TOKEN_EXPORT_COLUMNS, base, 'Tokens');
    } else {
      exportPDF({
        filename: base,
        title: 'Token Export',
        subtitle: `${filteredTokens.length} tokens`,
        columns: TOKEN_EXPORT_COLUMNS,
        data: filteredTokens,
      });
    }
  }, [filteredTokens]);

  // ── 5. Conditional returns AFTER all hooks ────────────────────────────────
  if (isLoading) return null;
  if (!user || (user.role !== 'organizer' && user.role !== 'admin')) return null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between"
        >
          <div className="space-y-1">
            <h1 className="text-4xl font-bold text-foreground">Token Management</h1>
            <p className="text-muted-foreground">Generate, assign, validate, and track all draw tokens</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => { setModal('validate'); setValidateResult(null); setValidateInput(''); }}
              variant="outline"
              className="border-primary/20"
            >
              <IconCheck size={14} stroke={1.5} /> Validate Token
            </Button>
            <Button
              onClick={() => { setModal('generate'); setGenPreview([]); setGenSuccess(false); }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              + Generate Tokens
            </Button>
          </div>
        </motion.div>

        {/* ── Stats ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4"
        >
          {[
            { label: 'Total',   value: stats.total,   color: 'text-foreground', bg: 'bg-card border-primary/20' },
            { label: 'Active',  value: stats.active,  color: 'text-green-400',  bg: 'bg-green-500/5 border-green-500/20' },
            { label: 'Used',    value: stats.used,    color: 'text-blue-400',   bg: 'bg-blue-500/5  border-blue-500/20' },
            { label: 'Expired', value: stats.expired, color: 'text-red-400',    bg: 'bg-red-500/5   border-red-500/20' },
            { label: 'Revoked', value: stats.revoked, color: 'text-gray-400',   bg: 'bg-muted/50    border-muted' },
          ].map((s, idx) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className={`border rounded-lg p-4 space-y-2 ${s.bg}`}
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Search & Filters ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col md:flex-row gap-3"
        >
          <Input
            type="text"
            placeholder="Search by token ID, participant, draw, email…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 border-primary/20 bg-background text-foreground"
          />
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {(['all', 'active', 'used', 'expired', 'revoked'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                    filter === f ? 'bg-slate-800 text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {(['all', 'numeric', 'alphanumeric'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormatFilter(f)}
                  className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                    formatFilter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f === 'all' ? 'All Formats' : f}
                </button>
              ))}
            </div>
            <Button
              onClick={() => handleExport('pdf')}
              variant="outline"
              size="sm"
              className="border-primary/20 text-xs"
            >
              ↓ Export PDF
            </Button>
            <Button
              onClick={() => handleExport('excel')}
              variant="outline"
              size="sm"
              className="border-primary/20 text-xs"
            >
              ↓ Export Excel
            </Button>
          </div>
        </motion.div>

        {/* ── Token Table ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-primary/20 rounded-lg overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-primary/20 bg-muted">
                <tr>
                  {['Token ID', 'Format', 'Participant', 'Draw', 'Status', 'Created', 'Expiry', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                <AnimatePresence>
                  {paginated.map((token, idx) => (
                    <motion.tr
                      key={token.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: idx * 0.03 }}
                      className={`transition-colors hover:bg-primary/5 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-primary/[0.04]'}`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-slate-700 font-bold">{token.tokenCode}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3"><FormatBadge format={token.format} /></td>
                      <td className="px-5 py-3">
                        <p className="text-sm text-foreground font-medium">{token.participantName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{token.participantEmail}</p>
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{token.drawName}</td>
                      <td className="px-5 py-3"><StatusBadge status={token.status} /></td>
                      <td className="px-5 py-3 text-sm font-mono text-muted-foreground">{token.createdDate}</td>
                      <td className="px-5 py-3 text-sm font-mono text-muted-foreground">{token.expiryDate}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setSelectedToken(token); setModal('history'); }}
                            className="text-xs text-primary hover:text-primary/80 font-mono transition-colors"
                          >
                            History
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {filteredTokens.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No tokens match your current filters.</p>
            </div>
          )}

          <div className="border-t border-primary/10 px-5 py-3 bg-muted/30 flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-mono">
              Showing {paginated.length} of {filteredTokens.length} tokens
            </p>
            <Pagination page={page} totalItems={filteredTokens.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {modal && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setModal(null); setSelectedToken(null); }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-primary/20 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              {/* ─── Generate Modal ─── */}
              {modal === 'generate' && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">Batch Generate Tokens</h2>
                      <p className="text-sm text-muted-foreground">Tokens are guaranteed unique across all draws</p>
                    </div>
                    <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1.5">
                      <label className="block text-sm font-medium text-foreground">Draw</label>
                      <select
                        value={genDrawId}
                        onChange={e => setGenDrawId(e.target.value)}
                        className="w-full border border-primary/20 bg-background text-foreground rounded-md px-3 py-2 text-sm"
                      >
                        {draws.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                      </select>
                      <p className="text-xs text-muted-foreground">Tokens are added to the pool — participants can claim them via "Buy Tokens"</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-foreground">Token Format</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(['numeric', 'alphanumeric'] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => { setGenFormat(f); setGenPreview([]); }}
                            className={`py-2 rounded text-xs font-mono border transition-all ${
                              genFormat === f
                                ? 'bg-slate-800 text-white border-slate-300'
                                : 'border-primary/20 text-muted-foreground hover:border-primary/40'
                            }`}
                          >
                            {f === 'numeric' ? '# Numeric' : 'Aa Alpha'}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {genFormat === 'numeric'      ? '8-digit numeric code (e.g. TK-83912847)' :
                                                       '8-char alphanumeric, no O/0/I/1 (e.g. TK-ABCD3F72)'}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-foreground">Count</label>
                      <Input
                        type="number"
                        value={genCount}
                        onChange={e => { setGenCount(e.target.value); setGenPreview([]); }}
                        min="1"
                        max="1000"
                        className="border-primary/20 bg-background text-foreground"
                      />
                      <p className="text-xs text-muted-foreground">Max 1,000 per batch</p>
                    </div>

                    <div className="col-span-2 space-y-1.5">
                      <label className="block text-sm font-medium text-foreground">Expiry (days from today)</label>
                      <Input
                        type="number"
                        value={genExpiry}
                        onChange={e => setGenExpiry(e.target.value)}
                        min="1"
                        className="border-primary/20 bg-background text-foreground"
                      />
                    </div>
                  </div>

                  {genPreview.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-muted/50 border border-primary/20 rounded-lg p-4 space-y-2"
                    >
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Preview (first 5)</p>
                      {genPreview.map((id, i) => (
                        <p key={i} className="font-mono text-sm text-slate-700">{id}</p>
                      ))}
                      <p className="text-xs text-green-400 mt-2 flex items-center gap-1"><IconCircleCheck size={14} stroke={1.5} /> All tokens verified unique — no duplicates detected</p>
                    </motion.div>
                  )}

                  {apiError && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-center"
                    >
                      <p className="text-destructive font-bold flex items-center gap-1"><IconX size={14} stroke={1.5} /> {apiError}</p>
                    </motion.div>
                  )}

                  {genSuccess && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center"
                    >
                      <p className="text-green-400 font-bold flex items-center gap-1"><IconCircleCheck size={14} stroke={1.5} /> Tokens generated successfully!</p>
                    </motion.div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={handlePreviewGenerate} variant="outline" className="flex-1 border-primary/20">
                      Preview
                    </Button>
                    <Button onClick={handleConfirmGenerate} className="flex-1 bg-slate-800 text-white hover:bg-slate-700">
                      Generate {genCount} Token{parseInt(genCount) !== 1 ? 's' : ''}
                    </Button>
                  </div>
                </div>
              )}

              {/* ─── Validate Modal ─── */}
              {modal === 'validate' && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">Validate Token</h2>
                      <p className="text-sm text-muted-foreground">Check if a token is valid before the draw</p>
                    </div>
                    <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
                  </div>

                  <div className="space-y-3">
                    <Input
                      placeholder="Enter token ID (e.g. TK-83912847)"
                      value={validateInput}
                      onChange={e => { setValidateInput(e.target.value); setValidateResult(null); }}
                      className="border-primary/20 bg-background text-foreground font-mono"
                    />
                    <Button onClick={handleValidate} className="w-full bg-slate-800 text-white hover:bg-slate-700">
                      Validate
                    </Button>
                  </div>

                  <AnimatePresence mode="wait">
                    {validateResult && (
                      <motion.div
                        key={validateResult}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`rounded-lg p-4 border ${
                          validateResult === 'valid'   ? 'bg-green-500/10 border-green-500/30' :
                          validateResult === 'used'    ? 'bg-blue-500/10  border-blue-500/30'  :
                          validateResult === 'expired' ? 'bg-red-500/10   border-red-500/30'   :
                                                         'bg-gray-500/10  border-gray-500/30'
                        }`}
                      >
                        <p className={`font-bold text-sm ${
                          validateResult === 'valid'   ? 'text-green-400' :
                          validateResult === 'used'    ? 'text-blue-400'  :
                          validateResult === 'expired' ? 'text-red-400'   :
                                                         'text-gray-400'
                        }`}>
                          {validateResult === 'valid'   ? <><IconCheck size={14} stroke={1.5} /> Token is VALID — eligible for this draw</> :
                           validateResult === 'used'    ? <><IconX size={14} stroke={1.5} /> Token already USED — cannot re-enter</>    :
                           validateResult === 'expired' ? <><IconX size={14} stroke={1.5} /> Token EXPIRED — no longer valid</>         :
                                                          <><IconX size={14} stroke={1.5} /> Token NOT FOUND — may be invalid or revoked</>}
                        </p>
                        {validateResult === 'valid' && (() => {
                          const t = tokens.find(tk => tk.id === validateInput.trim())!;
                          return (
                            <div className="mt-3 space-y-1 text-xs text-muted-foreground font-mono">
                              <p>Draw: {t.drawName}</p>
                              <p>Participant: {t.participantName}</p>
                              <p>Expires: {t.expiryDate}</p>
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* ─── History Modal ─── */}
              {modal === 'history' && selectedToken && (
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">Token History</h2>
                      <p className="font-mono text-slate-700 text-sm">{selectedToken.id}</p>
                    </div>
                    <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
                  </div>

                  <div className="bg-muted/50 border border-primary/20 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Participant</p>
                        <p className="text-foreground font-medium">{selectedToken.participantName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{selectedToken.participantEmail}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Draw</p>
                        <p className="text-foreground font-medium">{selectedToken.drawName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Format</p>
                        <FormatBadge format={selectedToken.format} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                        <StatusBadge status={selectedToken.status} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Event Timeline</p>
                    <div className="space-y-2">
                      {[
                        { date: selectedToken.createdDate, label: 'Token generated & assigned',           color: 'text-green-400', dot: 'bg-green-400' },
                        ...(selectedToken.regeneratedFrom ? [{ date: selectedToken.createdDate, label: `Regenerated from ${selectedToken.regeneratedFrom}`, color: 'text-slate-700',   dot: 'bg-slate-300'    }] : []),
                        ...(selectedToken.usedDate        ? [{ date: selectedToken.usedDate,    label: 'Token used in draw entry',                          color: 'text-blue-400', dot: 'bg-blue-400'  }] : []),
                        ...(selectedToken.status === 'expired' ? [{ date: selectedToken.expiryDate, label: 'Token expired',                  color: 'text-red-400',  dot: 'bg-red-400'   }] : []),
                        ...(selectedToken.status === 'revoked' ? [{ date: '—',                    label: 'Token revoked by organizer',       color: 'text-gray-400', dot: 'bg-gray-400'  }] : []),
                      ].map((ev, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ev.dot}`} />
                          <div className="flex-1 flex items-center justify-between">
                            <p className={`text-sm ${ev.color}`}>{ev.label}</p>
                            <p className="text-xs text-muted-foreground font-mono">{ev.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button onClick={() => setModal(null)} variant="outline" className="w-full border-primary/20">
                    Close
                  </Button>
                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  </div>
  );
}