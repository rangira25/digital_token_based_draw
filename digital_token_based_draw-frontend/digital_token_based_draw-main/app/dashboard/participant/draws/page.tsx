'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, apiUrls } from '@/lib/api';
import { IconCash, IconPackage, IconTicket, IconSparkles, IconKey, IconCheck, IconHourglass, IconTrophy, IconTag, IconCreditCard, IconFileText, IconClock, IconX, IconAlertTriangle } from '@tabler/icons-react';
import { Pagination } from '@/components/Pagination';

// ─── Types ────────────────────────────────────────────────────────────────────

type ClaimStatus    = 'unclaimed' | 'pending' | 'claimed' | 'expired';
type DeliveryStatus = 'not_started' | 'processing' | 'shipped' | 'delivered';
type EntryType      = 'free' | 'token' | 'paid';
type DrawStatus     = 'draft' | 'active' | 'closed' | 'completed';

interface PrizeTier {
  rank: number;
  label: string;
  description: string;
  value: number;
  quantity: number;
  category: 'cash' | 'product' | 'voucher' | 'experience' | 'license';
}

interface EligibilityCriteria {
  minAge: string;
  requiresVerifiedId: boolean;
  requiresVerifiedEmail: boolean;
  allowedRegions: string;
  otherRequirements: string;
}

interface Draw {
  id: string;
  name: string;
  status: DrawStatus;
  organizer: string;
  description: string;
  startDate: string;
  endDate: string;
  drawDate: string;
  prizes: PrizeTier[];
  participants: number;
  maxParticipants: number;
  entryType: EntryType;
  tokenPrice: number;
  entryLimitPerParticipant: number;
  eligibility: EligibilityCriteria;
  rules: string;
  terms: string;
  entered: boolean;
  myEntries: number;
  entryChance: string;
}

interface MyPrize {
  drawId: string;
  drawName: string;
  tier: PrizeTier;
  wonAt: string;
  claimStatus: ClaimStatus;
  claimDeadline: string;
  deliveryStatus: DeliveryStatus;
  trackingNumber?: string;
  claimedAt?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_DRAWS: Draw[] = [
  {
    id: '1', name: 'Product Launch Giveaway', status: 'active',
    organizer: 'TechCorp Inc',
    description: '3 lucky winners will receive premium tech products',
    startDate: '2026-05-10', endDate: '2026-05-20', drawDate: '2026-05-21',
    prizes: [
      { rank: 1, label: '1st Place', description: 'MacBook Pro 16"', value: 2499, quantity: 1, category: 'product' },
      { rank: 2, label: '2nd Place', description: 'iPad Air',         value: 599,  quantity: 1, category: 'product' },
      { rank: 3, label: '3rd Place', description: 'AirPods Pro',      value: 249,  quantity: 1, category: 'product' },
    ],
    participants: 1250, maxParticipants: 2000,
    entryType: 'free', tokenPrice: 0, entryLimitPerParticipant: 1,
    eligibility: { minAge: '18+', requiresVerifiedId: true, requiresVerifiedEmail: true, allowedRegions: 'Worldwide', otherRequirements: '' },
    rules: '1. One entry per participant.\n2. Must be 18+ to enter.\n3. Winners selected by cryptographic algorithm.\n4. Prizes must be claimed within 21 days.',
    terms: 'Open to residents worldwide. Void where prohibited. By entering, you agree to be contacted by TechCorp Inc.',
    entered: true, myEntries: 1, entryChance: '0.24%',
  },
  {
    id: '2', name: 'Community Recognition', status: 'active',
    organizer: 'OpenSource Foundation',
    description: 'Supporting developers who contribute to open source',
    startDate: '2026-05-15', endDate: '2026-05-25', drawDate: '2026-05-26',
    prizes: [
      { rank: 1, label: 'Gold',   description: '$500 Gift Card', value: 500, quantity: 5, category: 'voucher' },
      { rank: 2, label: 'Silver', description: '$200 Gift Card', value: 200, quantity: 5, category: 'voucher' },
    ],
    participants: 890, maxParticipants: 1000,
    entryType: 'token', tokenPrice: 0, entryLimitPerParticipant: 3,
    eligibility: { minAge: '18+', requiresVerifiedId: true, requiresVerifiedEmail: true, allowedRegions: 'Worldwide', otherRequirements: 'Must be a verified open source contributor' },
    rules: '1. Up to 3 token entries per person.\n2. Must be a verified contributor.\n3. Winners announced within 24 hours of draw.',
    terms: 'Open to verified contributors only. Past winners may re-enter after 6 months.',
    entered: false, myEntries: 0, entryChance: '1.12%',
  },
  {
    id: '3', name: 'Beta Tester Selection', status: 'active',
    organizer: 'DevTools Inc',
    description: 'Join our exclusive beta testing program',
    startDate: '2026-05-20', endDate: '2026-05-30', drawDate: '2026-05-31',
    prizes: [
      { rank: 1, label: 'Winner', description: 'Lifetime License', value: 299, quantity: 5, category: 'license' },
    ],
    participants: 450, maxParticipants: 500,
    entryType: 'free', tokenPrice: 0, entryLimitPerParticipant: 1,
    eligibility: { minAge: '18+', requiresVerifiedId: false, requiresVerifiedEmail: true, allowedRegions: 'Worldwide', otherRequirements: 'Verified developer account required' },
    rules: '1. One entry per developer account.\n2. Winners must sign NDA within 7 days.\n3. Beta access is non-transferable.',
    terms: 'Beta access subject to NDA. DevTools Inc reserves the right to revoke access for misuse.',
    entered: false, myEntries: 0, entryChance: '2.22%',
  },
  {
    id: '4', name: 'Design Challenge Winner', status: 'active',
    organizer: 'Creative Studios',
    description: 'Submit your design and compete for amazing prizes',
    startDate: '2026-05-10', endDate: '2026-06-01', drawDate: '2026-06-02',
    prizes: [
      { rank: 1, label: '1st Place', description: 'Cash Prize',        value: 10000, quantity: 1, category: 'cash' },
      { rank: 2, label: 'Featured', description: 'Platform Feature',   value: 0,     quantity: 3, category: 'experience' },
    ],
    participants: 320, maxParticipants: 1000,
    entryType: 'paid', tokenPrice: 9.99, entryLimitPerParticipant: 5,
    eligibility: { minAge: '18+', requiresVerifiedId: true, requiresVerifiedEmail: true, allowedRegions: 'US, CA, UK, AU', otherRequirements: 'Must submit original work' },
    rules: '1. Each token = one design submission.\n2. Max 5 submissions.\n3. Work must be original.\n4. Winners verified within 14 days of close.',
    terms: 'Submissions become property of Creative Studios upon winning. Runner-ups retain rights. Void in prohibited jurisdictions.',
    entered: false, myEntries: 0, entryChance: '3.13%',
  },
];

const MOCK_MY_PRIZES: MyPrize[] = [
  {
    drawId: 'past-1', drawName: 'Spring Giveaway 2026',
    tier: { rank: 1, label: '1st Place', description: '$500 Amazon Gift Card', value: 500, quantity: 1, category: 'voucher' },
    wonAt: '2026-05-01 14:30:22', claimStatus: 'pending',
    claimDeadline: '2026-05-22', deliveryStatus: 'not_started',
  },
  {
    drawId: 'past-2', drawName: 'Developer Raffle Q1',
    tier: { rank: 2, label: '2nd Place', description: 'JetBrains All Products Pack', value: 799, quantity: 1, category: 'license' },
    wonAt: '2026-03-15 10:00:00', claimStatus: 'claimed',
    claimDeadline: '2026-03-29', claimedAt: '2026-03-18 09:12:00',
    deliveryStatus: 'delivered', trackingNumber: 'JB-2026-4412',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const categoryIconMap: Record<string, React.ComponentType<any>> = { cash: IconCash, product: IconPackage, voucher: IconTicket, experience: IconSparkles, license: IconKey };
const claimStatusConfig: Record<ClaimStatus, { label: string; color: string }> = {
  unclaimed: { label: 'Unclaimed', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  pending:   { label: 'Pending',   color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  claimed:   { label: 'Claimed',   color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  expired:   { label: 'Expired',   color: 'bg-red-500/10 text-red-500 border-red-500/30' },
};

function daysUntil(date: string) {
  return Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86400000));
}

function totalPool(prizes: PrizeTier[]) {
  return prizes.reduce((s, p) => s + p.value * p.quantity, 0);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EligibilityChecker({ eligibility }: { eligibility: EligibilityCriteria }) {
  const checks = [
    { label: `Age ${eligibility.minAge}`,                   met: true },
    { label: 'Verified email',                              met: true },
    { label: 'Verified government ID',                      met: eligibility.requiresVerifiedId ? true : null },
    { label: `Open to: ${eligibility.allowedRegions}`,      met: true },
    ...(eligibility.otherRequirements ? [{ label: eligibility.otherRequirements, met: null }] : []),
  ].filter(c => c.met !== null || c.label);

  return (
    <div className="space-y-1.5">
      {checks.map((c, i) => (
        <div key={i} className={`flex items-center gap-2 text-xs ${c.met === true ? 'text-green-400' : c.met === false ? 'text-red-400' : 'text-muted-foreground'}`}>
          <span className="shrink-0">{c.met === true ? 'check' : c.met === false ? 'x' : 'circle'}</span>
          <span>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AvailableDrawsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [draws, setDraws]               = useState<Draw[]>([]);
  const [myPrizes, setMyPrizes]         = useState<MyPrize[]>([]);
  const [searchTerm, setSearchTerm]     = useState('');
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [filterEntryType, setFilterEntryType] = useState<'all' | EntryType>('all');
  const [activeTab, setActiveTab]       = useState<'draws' | 'my-prizes'>('draws');
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [selectedDraw, setSelectedDraw] = useState<Draw | null>(null);
  const [apiError, setApiError]         = useState('');
  const [page, setPage]                 = useState(1);
  const PAGE_SIZE = 10;

  const [modal, setModal] = useState<'buyToken' | 'enterDraw' | 'checkToken' | null>(null);
  const [modalDraw, setModalDraw] = useState<Draw | null>(null);
  const [buyQty, setBuyQty] = useState('1');
  const [buyLoading, setBuyLoading] = useState(false);
  const [buySuccess, setBuySuccess] = useState<string[]>([]);
  const [enterTokenCode, setEnterTokenCode] = useState('');
  const [enterLoading, setEnterLoading] = useState(false);
  const [eligibleTokens, setEligibleTokens] = useState<any[]>([]);
  const [eligibleLoad, setEligibleLoad] = useState(false);
  const [selectedTokenIdxes, setSelectedTokenIdxes] = useState<number[]>([]);
  const [checkTokenInput, setCheckTokenInput] = useState('');
  const [checkResult, setCheckResult] = useState<any>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [poolInfo, setPoolInfo] = useState<{ available: number; claimed: number; used: number } | null>(null);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'participant') router.push('/auth');
  }, [user, isLoading, router]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterUrgent, filterEntryType]);

  // Fetch draws and prizes from API
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [drawsRes, entriesRes] = await Promise.all([
          api<{ success: boolean; data: any[] }>(apiUrls.draws.list),
          api<{ success: boolean; data: any[] }>(apiUrls.tokens.myEntries).catch(() => ({ data: [] })),
        ]);

        const apiDraws: Draw[] = (drawsRes.data || []).map((d: any) => ({
          id: d.id, name: d.title, status: d.status === 'open' ? 'active' : d.status === 'draft' ? 'draft' : d.status === 'completed' ? 'completed' : 'closed',
          organizer: d.organizer_name || 'Unknown', description: d.description || '',
          startDate: d.registration_start?.split('T')[0] || '', endDate: d.registration_end?.split('T')[0] || '',
          drawDate: d.draw_date?.split('T')[0] || '',
          prizes: (d.prizes || []).map((p: any, i: number) => ({
            rank: p.rank || i + 1, label: p.title || `Prize ${i + 1}`, description: p.description || '', value: p.value || 0,
            quantity: p.quantity || 1, category: (p.prize_type || 'product') as PrizeTier['category'],
          })),
          participants: parseInt(d.entry_count) || 0, maxParticipants: d.max_participants || 1000,
          entryType: (d.tokens_per_entry > 0 ? 'token' : 'free') as EntryType,
          tokenPrice: parseFloat(d.token_price) || 0, entryLimitPerParticipant: d.max_entries_per_user || 1,
          eligibility: { minAge: '18+', requiresVerifiedId: true, requiresVerifiedEmail: true, allowedRegions: 'Worldwide', otherRequirements: d.eligibility_notes || '' },
          rules: '', terms: '',
          entered: (entriesRes.data || []).some((e: any) => e.draw_id === d.id),
          myEntries: (entriesRes.data || []).filter((e: any) => e.draw_id === d.id).length,
          entryChance: d.max_participants ? `${((d.winners_count || 1) / d.max_participants * 100).toFixed(2)}%` : 'N/A',
        }));
        setDraws(apiDraws);

        const apiPrizes: MyPrize[] = (entriesRes.data || [])
          .filter((e: any) => e.winner_id)
          .map((e: any) => ({
            drawId: e.draw_id, drawName: e.draw_title || 'Draw',
            tier: {
              rank: e.winner_rank || 1, label: e.prize_title || `Prize ${e.winner_rank || 1}`,
              description: '', value: e.prize_value || 0,
              quantity: 1, category: 'product' as PrizeTier['category'],
            },
            wonAt: e.draw_date || '', claimStatus: (e.winner_status === 'claimed' || e.winner_status === 'selected' ? 'claimed' : e.winner_status === 'notified' ? 'pending' : 'unclaimed') as ClaimStatus,
            claimDeadline: e.claim_deadline?.split('T')[0] || '',
            deliveryStatus: 'not_started' as DeliveryStatus,
          }));
        setMyPrizes(apiPrizes);
      } catch {}
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (user) setBalance(user.balance || 0);
  }, [user]);

  const filteredDraws = useMemo(() => draws.filter(d => {
    if (d.status !== 'active') return false;
    const q = searchTerm.toLowerCase();
    const matchSearch = !q || d.name.toLowerCase().includes(q) || d.organizer.toLowerCase().includes(q);
    const matchUrgent = !filterUrgent || daysUntil(d.endDate) <= 7;
    const matchEntry  = filterEntryType === 'all' || d.entryType === filterEntryType;
    return matchSearch && matchUrgent && matchEntry;
  }), [draws, searchTerm, filterUrgent, filterEntryType]);

  const paginatedDraws = useMemo(() => filteredDraws.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredDraws, page]);

  const stats = useMemo(() => ({
    available: filteredDraws.length,
    entered:   draws.filter(d => d.entered).length,
    endingSoon: draws.filter(d => d.status === 'active' && daysUntil(d.endDate) <= 7).length,
    totalPoolAvailable: draws.filter(d => d.status === 'active').reduce((s, d) => s + totalPool(d.prizes), 0),
  }), [draws, filteredDraws]);

  const pendingClaims = myPrizes.filter(p => p.claimStatus === 'unclaimed' || p.claimStatus === 'pending').length;

  const handleEnter = async (draw: Draw) => {
    setModalDraw(draw);
    setSelectedTokenIdxes([]);
    setEnterTokenCode('');
    setEligibleTokens([]);
    setEligibleLoad(true);
    setModal('enterDraw');
    try {
      const res = await api<{ success: boolean; data: any[] }>(`${apiUrls.tokens.myTokens}?draw_id=${draw.id}`);
      const issued = (res.data || []).filter((t: any) => t.status === 'issued');
      setEligibleTokens(issued);
    } catch {} finally {
      setEligibleLoad(false);
    }
  };

  const handleEnterSubmit = async () => {
    if (!modalDraw) return;
    const codes = [
      ...selectedTokenIdxes.map(i => eligibleTokens[i]?.token_code).filter(Boolean),
      ...(enterTokenCode.trim() ? [enterTokenCode.trim()] : []),
    ];
    if (codes.length === 0) return;
    setEnterLoading(true);
    setApiError('');
    try {
      let submitted = 0;
      for (const code of codes) {
        await api(apiUrls.tokens.submitEntry, {
          method: 'POST',
          body: JSON.stringify({ draw_id: modalDraw.id, token_code: code }),
        });
        submitted++;
      }
      setDraws(prev => prev.map(d => d.id === modalDraw.id ? { ...d, entered: true, myEntries: d.myEntries + submitted, participants: d.participants + submitted } : d));
      setModal(null);
      setModalDraw(null);
      setSelectedTokenIdxes([]);
      setEnterTokenCode('');
    } catch (err: any) {
      setApiError(err.message);
    }
    setEnterLoading(false);
  };

  const handleBuyToken = async (draw: Draw) => {
    setModalDraw(draw);
    setBuyQty('1');
    setBuySuccess([]);
    setPoolInfo(null);
    setModal('buyToken');
    // Fetch pool info
    try {
      const res = await api<{ success: boolean; data: any }>(apiUrls.tokens.pool(draw.id));
      setPoolInfo(res.data);
    } catch { /* ignore */ }
  };

  const handleBuySubmit = async () => {
    if (!modalDraw) return;
    setBuyLoading(true);
    setApiError('');
    try {
      const qty = Math.min(Math.max(parseInt(buyQty) || 1, 1), 10);
      const res = await api<{ success: boolean; data: any[] }>(apiUrls.tokens.request, {
        method: 'POST',
        body: JSON.stringify({ draw_id: modalDraw.id, quantity: qty }),
      });
      const codes = (res.data || []).map((t: any) => t.token_code);
      setBuySuccess(codes);
      // Refresh balance
      const meRes = await api<{ success: boolean; data: any }>(apiUrls.auth.me).catch(() => null);
      if (meRes?.data) setBalance(parseFloat(meRes.data.balance) || 0);
    } catch (err: any) {
      setApiError(err.message);
    }
    setBuyLoading(false);
  };

  const handleCheckToken = () => {
    setCheckTokenInput('');
    setCheckResult(null);
    setModal('checkToken');
  };

  const handleCheckSubmit = async () => {
    if (!checkTokenInput.trim()) return;
    setCheckLoading(true);
    setCheckResult(null);
    try {
      const res = await api<{ success: boolean; data: any }>(apiUrls.tokens.validate(checkTokenInput.trim()));
      setCheckResult(res.data);
    } catch (err: any) {
      setCheckResult({ error: err.message || 'Token not found' });
    }
    setCheckLoading(false);
  };

  const handleWithdraw = (id: string) =>
    setDraws(prev => prev.map(d => d.id === id ? { ...d, entered: false, myEntries: 0, participants: d.participants - 1 } : d));

  if (isLoading || !user) return null;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl font-bold text-foreground">Draws</h1>
            <p className="text-muted-foreground mt-1">Discover draws, check eligibility, and track your prizes.</p>
          </motion.div>

          {apiError && (
            <div className="bg-destructive/10 border border-destructive/40 text-destructive text-sm p-3 rounded">{apiError}</div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-primary/10">
            {[
              { id: 'draws' as const, label: 'Available Draws' },
              { id: 'my-prizes' as const, label: `My Prizes${pendingClaims > 0 ? ` (${pendingClaims})` : ''}` },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">

            {/* ── DRAWS TAB ── */}
            {activeTab === 'draws' && (
              <motion.div key="draws" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Available',    value: stats.available,                                color: 'text-slate-700' },
                    { label: 'My Entries',   value: stats.entered,                                  color: 'text-primary' },
                    { label: 'Ending Soon',  value: stats.endingSoon,                               color: 'text-yellow-400' },
                    { label: 'Total Pool',   value: `$${stats.totalPoolAvailable.toLocaleString()}`, color: 'text-green-400' },
                  ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }} className="bg-card border border-primary/20 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Filters */}
                <div className="flex gap-3 flex-wrap">
                  <Input placeholder="Search draws or organizer…" value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-1 min-w-48 border-primary/20 bg-background text-foreground" />
                  <div className="flex gap-1 bg-muted rounded-lg p-1">
                    {(['all', 'free', 'token', 'paid'] as const).map(et => (
                      <button key={et} onClick={() => setFilterEntryType(et)}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${filterEntryType === et ? 'bg-slate-900 text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                        {et === 'all' ? 'All' : et === 'free' ? 'Free' : et === 'token' ? 'Token' : 'Paid'}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setFilterUrgent(!filterUrgent)}
                    className={`px-4 py-2 rounded-lg border text-xs font-medium transition-all ${filterUrgent ? 'border-slate-900 bg-slate-900 text-white' : 'border-primary/20 text-muted-foreground hover:text-foreground'}`}>
                    <IconHourglass size={14} stroke={1.5} /> Ending Soon
                  </button>
                </div>

                {/* Draw Cards */}
                <div className="space-y-4">
                  {paginatedDraws.map((draw, idx) => {
                    const pool = totalPool(draw.prizes);
                    const daysLeft = daysUntil(draw.endDate);
                    const isUrgent = daysLeft <= 7;
                    const pct = draw.maxParticipants > 0 ? Math.min(100, (draw.participants / draw.maxParticipants) * 100) : 0;
                    const isExpanded = expandedId === draw.id;
                    const isSelected = selectedDraw?.id === draw.id;
                    const canAddEntry = draw.myEntries < draw.entryLimitPerParticipant;

                    return (
                      <motion.div key={draw.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className={`border rounded-xl overflow-hidden transition-all ${isUrgent ? 'border-slate-300 bg-slate-50' : 'border-primary/20 bg-card'}`}>

                        {/* Main card content */}
                        <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
                          {/* Left */}
                          <div className="lg:col-span-2 space-y-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                {draw.myEntries > 0 && <span className="text-xs bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full"><IconCheck size={12} stroke={2} /> {draw.myEntries}/{draw.entryLimitPerParticipant} Entries</span>}
                                {isUrgent && <span className="text-xs bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full"><IconHourglass size={12} stroke={2} /> Ending Soon</span>}
                                {draw.entryType === 'paid' && <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full"><IconCreditCard size={12} stroke={2} /> ${draw.tokenPrice}/token</span>}
                                {draw.entryType === 'token' && <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full"><IconTicket size={12} stroke={2} /> Token Entry</span>}
                              </div>
                              <h3 className="text-xl font-bold text-foreground">{draw.name}</h3>
                              <p className="text-xs text-primary font-medium">by {draw.organizer}</p>
                              <p className="text-sm text-muted-foreground mt-1">{draw.description}</p>
                            </div>

                            {/* Prize pool summary */}
                            <div className="bg-background/60 rounded-lg p-3 border border-primary/10">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-foreground">
                                  Prize Pool{pool > 0 && <span className="ml-2 text-slate-700">${pool.toLocaleString()} total</span>}
                                </p>
                                <button onClick={() => setExpandedId(isExpanded ? null : draw.id)}
                                  className="text-xs text-primary hover:text-primary/80">
                                  {isExpanded ? 'Less ↑' : `${draw.prizes.length} prize${draw.prizes.length > 1 ? 's' : ''} ↓`}
                                </button>
                              </div>
                              {/* Always show top prize */}
                              {draw.prizes.length > 0 && (<>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">{(() => { const Ic = categoryIconMap[draw.prizes[0].category]; return Ic ? <Ic size={16} stroke={1.5} /> : null; })()}</span>
                                <span className="text-primary font-medium text-xs w-14">{draw.prizes[0].label}</span>
                                <span className="text-foreground flex-1 truncate">{draw.prizes[0].description}</span>
                                {draw.prizes[0].value > 0 && <span className="text-slate-700 font-bold text-sm">${draw.prizes[0].value.toLocaleString()}</span>}
                              </div>
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                    {draw.prizes.slice(1).map(tier => (
                                      <div key={tier.rank} className="flex items-center gap-2 text-sm mt-1.5 pt-1.5 border-t border-primary/10">
                                         <span className="text-muted-foreground">{(() => { const Ic = categoryIconMap[tier.category]; return Ic ? <Ic size={16} stroke={1.5} /> : null; })()}</span>
                                        <span className="text-primary font-medium text-xs w-14">{tier.label}</span>
                                        <span className="text-foreground flex-1 truncate">{tier.description}</span>
                                        {tier.quantity > 1 && <span className="text-muted-foreground text-xs">×{tier.quantity}</span>}
                                        {tier.value > 0 && <span className="text-slate-700 font-semibold text-sm">${tier.value.toLocaleString()}</span>}
                                      </div>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                              </>)}
                            </div>

                            {/* Eligibility quick check */}
                            <div className="bg-background/60 rounded-lg p-3 border border-primary/10">
                              <p className="text-xs font-semibold text-foreground mb-2">Eligibility</p>
                              <EligibilityChecker eligibility={draw.eligibility} />
                            </div>

                            {/* Rules/Terms accordion */}
                            <button onClick={() => setSelectedDraw(isSelected ? null : draw)}
                              className="w-full text-left text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                              <IconFileText size={14} stroke={1.5} /> {isSelected ? 'Hide' : 'View'} Rules & Terms
                            </button>

                            <AnimatePresence>
                              {isSelected && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden space-y-3">
                                  <div className="bg-muted/30 border border-primary/10 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-foreground mb-2">Draw Rules</p>
                                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">{draw.rules}</pre>
                                  </div>
                                  <div className="bg-muted/30 border border-primary/10 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-foreground mb-2">Terms & Conditions</p>
                                    <p className="text-xs text-muted-foreground">{draw.terms}</p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Right: stats + entry */}
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-background/60 rounded-lg p-3 border border-primary/10 text-center">
                                <p className="text-xs text-muted-foreground mb-0.5">Draw Date</p>
                                <p className="text-sm font-bold text-foreground">{draw.drawDate.slice(5)}</p>
                              </div>
                              <div className="bg-background/60 rounded-lg p-3 border border-primary/10 text-center">
                                <p className="text-xs text-muted-foreground mb-0.5">Days Left</p>
                                <p className={`text-xl font-bold ${isUrgent ? 'text-slate-700' : 'text-primary'}`}>{daysLeft}</p>
                              </div>
                              <div className="bg-background/60 rounded-lg p-3 border border-primary/10 text-center">
                                <p className="text-xs text-muted-foreground mb-0.5">Entry Limit</p>
                                <p className="text-lg font-bold text-foreground">{draw.entryLimitPerParticipant}</p>
                              </div>
                            </div>

                            {/* Participants fill */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{draw.participants.toLocaleString()} entered</span>
                                <span>{draw.maxParticipants.toLocaleString()} max</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-slate-400 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              {pct >= 90 && <p className="text-xs text-red-400 flex items-center gap-1"><IconAlertTriangle size={12} stroke={2} /> Almost full!</p>}
                            </div>

                            {/* Entry actions */}
                            <div className="space-y-2">
                              {draw.entryType === 'paid' && !draw.entered && (
                                <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-2 text-center">
                                  <p className="text-xs text-muted-foreground">Entry cost</p>
                                  <p className="text-lg font-bold text-slate-700">${draw.tokenPrice}</p>
                                  <p className="text-xs text-muted-foreground">per token</p>
                                </div>
                              )}
                              {canAddEntry ? (
                                <>
                                  <Button onClick={() => handleBuyToken(draw)}
                                    className="w-full bg-slate-800 text-white hover:bg-slate-700 text-sm">
                                    Buy Token
                                  </Button>
                                  <Button onClick={() => handleEnter(draw)}
                                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm">
                                    Enter Draw with Token
                                  </Button>
                                </>
                              ) : (
                                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                                  <p className="text-sm font-medium text-green-600">Entry limit reached</p>
                                  <p className="text-xs text-muted-foreground mt-1">{draw.myEntries} / {draw.entryLimitPerParticipant} entries</p>
                                </div>
                              )}
                              {draw.status === 'completed' && (
                                <Button onClick={() => handleCheckToken()}
                                  variant="outline" className="w-full border-primary/20 text-xs">
                                  Check Token Result
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {filteredDraws.length > 0 && (
                  <Pagination page={page} totalItems={filteredDraws.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
                )}

                {filteredDraws.length === 0 && (
                  <div className="text-center py-16 bg-card border border-primary/20 rounded-lg">
                    <IconTicket className="mx-auto mb-4 text-muted-foreground" size={40} stroke={1} />
                    <p className="text-muted-foreground mb-4">No draws match your search.</p>
                    <Button onClick={() => { setSearchTerm(''); setFilterUrgent(false); setFilterEntryType('all'); }}
                      variant="outline" className="border-primary/20">Reset Filters</Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── MY PRIZES TAB ── */}
            {activeTab === 'my-prizes' && (
              <motion.div key="prizes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Total Won',   value: myPrizes.length, color: 'text-foreground' },
                    { label: 'To Claim',    value: pendingClaims,   color: 'text-yellow-600' },
                    { label: 'Claimed',     value: myPrizes.filter(p => p.claimStatus === 'claimed').length, color: 'text-green-600' },
                    { label: 'Total Value', value: `$${myPrizes.filter(p => p.claimStatus !== 'expired').reduce((s, p) => s + p.tier.value, 0).toLocaleString()}`, color: 'text-slate-700' },
                  ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.06 }} className="bg-card border border-primary/20 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Prizes */}
                <div className="space-y-4">
                  {myPrizes.map((prize, idx) => {
                    const deadlineDays = daysUntil(prize.claimDeadline);
                    const isExpiring = deadlineDays <= 3 && prize.claimStatus !== 'claimed' && prize.claimStatus !== 'expired';
                    const claimCfg = claimStatusConfig[prize.claimStatus];
                    return (
                      <motion.div key={prize.drawId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.07 }}
                        className={`border-2 rounded-xl p-5 space-y-4 ${
                          prize.claimStatus === 'expired' ? 'opacity-60 border-primary/10 bg-card' :
                          prize.claimStatus === 'claimed' ? 'border-green-500/20 bg-green-500/5' :
                          isExpiring ? 'border-red-500/30 bg-red-500/5' :
                          'border-slate-200 bg-slate-50'
                        }`}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg text-muted-foreground">{(() => { const Ic = categoryIconMap[prize.tier.category]; return Ic ? <Ic size={20} stroke={1.5} /> : null; })()}</span>
                              <h3 className="font-bold text-foreground">{prize.tier.description}</h3>
                            </div>
                            <p className="text-xs text-primary font-medium">{prize.drawName} · {prize.tier.label}</p>
                            {prize.tier.value > 0 && <p className="text-xl font-bold text-slate-700 mt-1">${prize.tier.value.toLocaleString()}</p>}
                          </div>
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full border shrink-0 ${claimCfg.color}`}>{claimCfg.label}</span>
                        </div>

                        {/* Deadline */}
                        {prize.claimStatus !== 'claimed' && prize.claimStatus !== 'expired' && (
                          <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${isExpiring ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-600'}`}>
                            <IconClock size={14} stroke={2} />
                            <span>Claim by <strong>{prize.claimDeadline}</strong> — {deadlineDays} day{deadlineDays !== 1 ? 's' : ''} left</span>
                          </div>
                        )}

                        {/* Delivery */}
                        {prize.claimStatus === 'claimed' && (
                          <div className="bg-background/60 rounded-lg p-3 border border-primary/10 space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="font-semibold text-muted-foreground">Delivery Status</span>
                              <span className="text-foreground capitalize">{prize.deliveryStatus.replace('_', ' ')}</span>
                            </div>
                            <div className="flex gap-1">
                              {(['processing', 'shipped', 'delivered'] as DeliveryStatus[]).map((step, i) => {
                                const steps = ['processing', 'shipped', 'delivered'];
                                return <div key={step} className={`flex-1 h-1.5 rounded-full ${i <= steps.indexOf(prize.deliveryStatus) ? 'bg-green-500' : 'bg-muted'}`} />;
                              })}
                            </div>
                            {prize.trackingNumber && (
                              <p className="text-xs text-muted-foreground font-mono">Tracking: <span className="text-foreground">{prize.trackingNumber}</span></p>
                            )}
                          </div>
                        )}

                        {(prize.claimStatus === 'unclaimed' || prize.claimStatus === 'pending') && (
                          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                            <p className="text-green-600 font-bold text-sm flex items-center justify-center gap-1">
                              <IconCheck size={16} stroke={2} /> Prize Credited
                            </p>
                            {prize.tier.value > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">${prize.tier.value.toLocaleString()} added to your balance</p>
                            )}
                          </div>
                        )}
                        {prize.claimStatus === 'claimed' && prize.claimedAt && (
                          <p className="text-xs text-green-600 flex items-center gap-1"><IconCheck size={12} stroke={2} /> Claimed on {prize.claimedAt}</p>
                        )}
                        {prize.claimStatus === 'expired' && (
                          <p className="text-xs text-red-500 flex items-center gap-1"><IconX size={12} stroke={2} /> Claim window expired {prize.claimDeadline}</p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {myPrizes.length === 0 && (
                  <div className="text-center py-16 bg-card border border-primary/20 rounded-lg">
                    <IconTrophy className="mx-auto mb-4 text-muted-foreground" size={40} stroke={1} />
                    <p className="text-muted-foreground mb-4">No prizes yet — enter a draw to win!</p>
                    <Button onClick={() => setActiveTab('draws')} className="bg-slate-900 text-white hover:bg-slate-800">Browse Draws</Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* ══════ MODALS ══════ */}
      <AnimatePresence>
        {modal && (
          <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setModal(null); setModalDraw(null); setCheckResult(null); }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }} onClick={e => e.stopPropagation()}
              className="bg-card border border-primary/20 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">

              {/* Buy Token Modal */}
              {modal === 'buyToken' && modalDraw && (
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">Buy Token</h2>
                      <p className="text-sm text-muted-foreground">for {modalDraw.name}</p>
                    </div>
                    <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
                  </div>

                  {buySuccess.length > 0 ? (
                    <div className="space-y-3">
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                        <p className="text-green-600 font-bold text-sm mb-2">Tokens purchased successfully!</p>
                        <p className="text-xs text-muted-foreground mb-3">Save these token codes — you will need them to enter the draw.</p>
                      </div>
                      <div className="space-y-1.5">
                        {buySuccess.map((code, i) => (
                          <div key={i} className="flex items-center justify-between bg-background border border-primary/10 rounded-lg px-3 py-2">
                            <span className="font-mono text-sm text-foreground font-bold">{code}</span>
                            <button onClick={() => navigator.clipboard.writeText(code)}
                              className="text-xs text-primary hover:text-primary/80">Copy</button>
                          </div>
                        ))}
                      </div>
                      <Button onClick={() => { setModal(null); setModalDraw(null); setBuySuccess([]); }} className="w-full bg-slate-800 text-white hover:bg-slate-700">
                        Done
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {apiError && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-600 text-center">
                          {apiError}
                        </div>
                      )}
                      {poolInfo && (
                        <div className="bg-background border border-primary/10 rounded-lg p-3">
                          <p className="text-xs font-mono text-muted-foreground uppercase mb-1">Pool Availability</p>
                          <p className="text-lg font-bold text-foreground">{poolInfo.available} token{poolInfo.available !== 1 ? 's' : ''} available</p>
                          <p className="text-xs text-muted-foreground">{poolInfo.claimed} claimed · {poolInfo.used} used</p>
                        </div>
                      )}
                      {modalDraw.tokenPrice > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Token Price</span>
                            <span className="font-bold text-foreground">${modalDraw.tokenPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Quantity</span>
                            <span className="font-bold text-foreground">x{parseInt(buyQty) || 1}</span>
                          </div>
                          <div className="flex justify-between text-sm border-t border-amber-500/20 pt-1 mt-1">
                            <span className="text-muted-foreground">Total Cost</span>
                            <span className="font-bold text-slate-700">${((modalDraw.tokenPrice) * (parseInt(buyQty) || 1)).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Your Balance</span>
                            <span className={`font-bold ${balance >= (modalDraw.tokenPrice) * (parseInt(buyQty) || 1) ? 'text-green-600' : 'text-red-500'}`}>
                              ${balance.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1 block">Quantity</label>
                        <Input type="number" min="1" max="10" value={buyQty}
                          onChange={e => setBuyQty(e.target.value)}
                          className="border-primary/20 bg-background text-foreground" />
                        <p className="text-xs text-muted-foreground mt-1">Max 10 tokens per request</p>
                      </div>
                      <Button onClick={handleBuySubmit}
                        disabled={buyLoading || !buyQty.trim() || (!!poolInfo && parseInt(buyQty) > poolInfo.available) || (modalDraw.tokenPrice > 0 && balance < (modalDraw.tokenPrice) * (parseInt(buyQty) || 1))}
                        className="w-full bg-slate-800 text-white hover:bg-slate-700">
                        {buyLoading ? 'Processing...' : modalDraw.tokenPrice > 0
                          ? `Buy ${parseInt(buyQty) || 1} Token(s) — $${((modalDraw.tokenPrice) * (parseInt(buyQty) || 1)).toFixed(2)}`
                          : `Claim ${parseInt(buyQty) || 1} Token(s) from Pool`}
                      </Button>
                      {poolInfo && parseInt(buyQty) > poolInfo.available && (
                        <p className="text-xs text-red-500 text-center">Not enough tokens in pool</p>
                      )}
                      {modalDraw.tokenPrice > 0 && balance < (modalDraw.tokenPrice) * (parseInt(buyQty) || 1) && (
                        <p className="text-xs text-red-500 text-center">Insufficient balance. Please top up your account.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Enter Draw Modal */}
              {modal === 'enterDraw' && modalDraw && (
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">Enter Draw</h2>
                      <p className="text-sm text-muted-foreground">{modalDraw.name}</p>
                    </div>
                    <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
                  </div>

                  {apiError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-600 text-center">{apiError}</div>
                  )}

                  {eligibleLoad ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">Loading your tokens...</div>
                  ) : (
                    <>
                      {eligibleTokens.length === 0 ? (
                        <div className="text-center py-6 space-y-3">
                          <p className="text-muted-foreground">No eligible tokens for this draw.</p>
                          <p className="text-xs text-muted-foreground">You must have an issued token that belongs to this draw. Buy a token first.</p>
                          <Button onClick={() => setModal('buyToken')} size="sm" className="bg-slate-800 text-white hover:bg-slate-700">
                            Buy Token
                          </Button>
                          <div className="pt-2">
                            <label className="text-sm font-medium text-foreground mb-1 block">Or enter a token code manually</label>
                            <Input value={enterTokenCode} onChange={e => setEnterTokenCode(e.target.value)}
                              placeholder="e.g. DRW-A1B2C3D4-E5F6G7H8"
                              className="font-mono border-primary/20 bg-background text-foreground" />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Select one or more tokens to enter this draw:</p>
                          <div className="space-y-1.5 max-h-60 overflow-y-auto">
                            {eligibleTokens.map((token, idx) => {
                              const isSelected = selectedTokenIdxes.includes(idx);
                              return (
                                <button key={token.id}
                                  onClick={() => setSelectedTokenIdxes(prev => isSelected ? prev.filter(i => i !== idx) : [...prev, idx])}
                                  className={`w-full text-left p-3 rounded-lg border text-sm transition-all flex items-center gap-3 ${
                                    isSelected
                                      ? 'border-slate-900 bg-slate-900 text-white'
                                      : 'border-primary/20 bg-background text-foreground hover:border-primary/40'
                                  }`}>
                                  <span className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                                    isSelected ? 'bg-white border-white text-slate-900' : 'border-current opacity-40'
                                  }`}>
                                    {isSelected && <IconCheck size={12} stroke={3} />}
                                  </span>
                                  <span className="font-mono font-bold">{token.token_code}</span>
                                  <span className={`text-xs ml-auto ${isSelected ? 'text-white/70' : 'text-muted-foreground'}`}>
                                    Issued: {token.issued_at?.split('T')[0] || ''}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <Button onClick={handleEnterSubmit}
                        disabled={enterLoading || (selectedTokenIdxes.length === 0 && !enterTokenCode.trim())}
                        className="w-full bg-slate-800 text-white hover:bg-slate-700">
                        {enterLoading ? 'Submitting...' : selectedTokenIdxes.length > 1 ? `Submit ${selectedTokenIdxes.length} Entries` : 'Submit Entry'}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Check Token Result Modal */}
              {modal === 'checkToken' && (
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">Check Token Result</h2>
                      <p className="text-sm text-muted-foreground">Enter your token code to see if you won</p>
                    </div>
                    <button onClick={() => { setModal(null); setCheckResult(null); }} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
                  </div>

                  {!checkResult ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1 block">Token Code</label>
                        <Input value={checkTokenInput} onChange={e => setCheckTokenInput(e.target.value)}
                          placeholder="e.g. DRW-A1B2C3D4-E5F6G7H8"
                          className="font-mono border-primary/20 bg-background text-foreground" />
                      </div>
                      <Button onClick={handleCheckSubmit} disabled={checkLoading || !checkTokenInput.trim()}
                        className="w-full bg-slate-800 text-white hover:bg-slate-700">
                        {checkLoading ? 'Checking...' : 'Check Result'}
                      </Button>
                    </div>
                  ) : checkResult.error ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                      <p className="text-red-500 font-bold text-sm">{checkResult.error}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className={`rounded-lg p-4 text-center border ${
                        checkResult.validity?.result === 'won' ? 'bg-green-500/10 border-green-500/30' :
                        checkResult.validity?.result === 'lost' ? 'bg-red-500/10 border-red-500/30' :
                        checkResult.validity?.result === 'claimed' ? 'bg-blue-500/10 border-blue-500/30' :
                        'bg-muted border-primary/20'
                      }`}>
                        {checkResult.validity?.result === 'won' ? (
                          <>
                            <p className="text-2xl mb-2">Winner!</p>
                            <p className="text-green-600 font-bold">You won {checkResult.validity.prize_title || `Prize #${checkResult.validity.winner_rank}`}!</p>
                            <p className="text-sm text-muted-foreground mt-1">Go to Results to claim your prize.</p>
                          </>
                        ) : checkResult.validity?.result === 'claimed' ? (
                          <>
                            <p className="text-2xl mb-2">Prize Claimed</p>
                            <p className="text-blue-500 font-bold">You already claimed {checkResult.validity.prize_title || `Prize #${checkResult.validity.winner_rank}`}</p>
                          </>
                        ) : checkResult.validity?.result === 'lost' ? (
                          <>
                            <p className="text-2xl mb-2">Not a winner</p>
                            <p className="text-red-500 font-bold">Better luck next time!</p>
                          </>
                        ) : checkResult.validity?.result === 'entered' ? (
                          <>
                            <p className="text-2xl mb-2">Entry pending</p>
                            <p className="text-muted-foreground">Your entry is registered. Waiting for draw results.</p>
                          </>
                        ) : (
                          <>
                            <p className="font-bold text-foreground">{checkResult.validity?.reason || 'Unknown status'}</p>
                          </>
                        )}
                      </div>
                      <div className="bg-background border border-primary/10 rounded-lg p-3 text-xs space-y-1.5 font-mono">
                        <div className="flex justify-between"><span className="text-muted-foreground">Token</span><span className="text-foreground">{checkResult.token?.token_code}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Draw</span><span className="text-foreground">{checkResult.token?.draw_title}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="text-foreground">{checkResult.token?.status}</span></div>
                        {checkResult.validity?.prize_title && (
                          <div className="flex justify-between"><span className="text-muted-foreground">Prize</span><span className="text-foreground">{checkResult.validity.prize_title} (${checkResult.validity.prize_value})</span></div>
                        )}
                        {checkResult.validity?.claim_deadline && (
                          <div className="flex justify-between"><span className="text-muted-foreground">Claim by</span><span className="text-foreground">{new Date(checkResult.validity.claim_deadline).toLocaleDateString()}</span></div>
                        )}
                      </div>
                      <Button onClick={() => { setCheckResult(null); setCheckTokenInput(''); }} variant="outline" className="w-full border-primary/20">
                        Check Another Token
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}