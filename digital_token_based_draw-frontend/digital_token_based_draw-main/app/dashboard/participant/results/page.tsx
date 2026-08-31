'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { Button } from '@/components/ui/button';
import { api, apiUrls } from '@/lib/api';
import { IconTicket, IconStar, IconPackage, IconClock, IconCheck, IconX, IconTrophy } from '@tabler/icons-react';
import { Pagination } from '@/components/Pagination';

interface CommunicationEntry {
  id: string;
  type: 'email' | 'sms' | 'system';
  message: string;
  timestamp: string;
  fromOrganizer: string;
}

interface DeliveryInfo {
  method: 'digital' | 'physical' | 'in-person';
  trackingId?: string;
  status: 'pending' | 'shipped' | 'delivered' | 'confirmed';
  estimatedDate?: string;
  confirmedAt?: string;
  notes?: string;
}

interface Result {
  id: string;
  drawName: string;
  organizer: string;
  type: 'won' | 'participated' | 'upcoming';
  status: 'won' | 'lost' | 'claimed' | 'pending';
  prize?: string;
  prizeValue?: string;
  announcedDate: string;
  claimedDate?: string;
  winnerId?: string;
  winnerRank?: number;
  verificationCode?: string;
  claimDeadline?: string;
  certificateAvailable: boolean;
  certificateUrl?: string;
  communications: CommunicationEntry[];
  delivery?: DeliveryInfo;
  drawDescription?: string;
}

const mockResults: Result[] = [
  {
    id: 'r1',
    drawName: 'Community Recognition',
    organizer: 'OpenSource Foundation',
    type: 'won',
    status: 'claimed',
    prize: '$500 Gift Card',
    prizeValue: '$500',
    announcedDate: '2026-05-01',
    claimedDate: '2026-05-02',
    certificateAvailable: true,
    certificateUrl: '/certs/r1.pdf',
    drawDescription: 'Annual community recognition award for outstanding contributors.',
    communications: [
      { id: 'cm1', type: 'email', message: 'Congratulations! You have won the $500 Gift Card in Community Recognition.', timestamp: '2026-05-01T09:00:00Z', fromOrganizer: 'OpenSource Foundation' },
      { id: 'cm2', type: 'system', message: 'Your prize has been processed and sent to your registered email.', timestamp: '2026-05-02T11:00:00Z', fromOrganizer: 'System' },
    ],
    delivery: { method: 'digital', status: 'confirmed', confirmedAt: '2026-05-02', notes: 'Gift card code delivered via email.' },
  },
  {
    id: 'r2',
    drawName: 'Product Launch Giveaway',
    organizer: 'TechCorp Inc',
    type: 'participated',
    status: 'pending',
    announcedDate: '2026-05-20',
    prizeValue: 'Prize Pool: $5000+',
    drawDescription: 'Exclusive giveaway celebrating the launch of TechCorp\'s newest product line.',
    certificateAvailable: false,
    communications: [
      { id: 'cm3', type: 'email', message: 'Your entry for Product Launch Giveaway has been received.', timestamp: '2026-05-15T08:00:00Z', fromOrganizer: 'TechCorp Inc' },
    ],
  },
  {
    id: 'r3',
    drawName: 'Spring Giveaway 2026',
    organizer: 'Tech Events',
    type: 'won',
    status: 'claimed',
    prize: 'Premium License 1-Year',
    prizeValue: 'License (~$299)',
    announcedDate: '2026-04-15',
    claimedDate: '2026-04-16',
    certificateAvailable: true,
    certificateUrl: '/certs/r3.pdf',
    drawDescription: 'Spring season giveaway for loyal community members.',
    communications: [
      { id: 'cm4', type: 'email', message: 'You\'ve won a 1-Year Premium License in Spring Giveaway 2026!', timestamp: '2026-04-15T10:00:00Z', fromOrganizer: 'Tech Events' },
      { id: 'cm5', type: 'email', message: 'Your license key has been sent. Check your email inbox.', timestamp: '2026-04-16T09:00:00Z', fromOrganizer: 'Tech Events' },
    ],
    delivery: { method: 'digital', status: 'confirmed', confirmedAt: '2026-04-16', notes: 'License key emailed successfully.' },
  },
  {
    id: 'r4',
    drawName: 'Influencer Challenge',
    organizer: 'Creative Studios',
    type: 'participated',
    status: 'lost',
    announcedDate: '2026-04-10',
    prizeValue: 'Prize Pool: $2000',
    drawDescription: 'Creative challenge for social media influencers and content creators.',
    certificateAvailable: false,
    communications: [
      { id: 'cm6', type: 'email', message: 'Thank you for participating in Influencer Challenge. Results have been announced.', timestamp: '2026-04-10T14:00:00Z', fromOrganizer: 'Creative Studios' },
    ],
  },
  {
    id: 'r5',
    drawName: 'Beta Tester Selection',
    organizer: 'DevTools Inc',
    type: 'upcoming',
    status: 'pending',
    announcedDate: '2026-05-30',
    prizeValue: 'Lifetime Access',
    drawDescription: 'Exclusive selection for beta testers of DevTools\'s next-gen product.',
    certificateAvailable: false,
    communications: [
      { id: 'cm7', type: 'system', message: 'Your entry for Beta Tester Selection is confirmed. Draw on 2026-05-30.', timestamp: '2026-05-16T08:00:00Z', fromOrganizer: 'System' },
    ],
  },
];

type FilterType = 'all' | 'won' | 'participated' | 'upcoming';

function CertificateModal({ result, onClose }: { result: Result; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card border border-primary/30 rounded-2xl p-8 max-w-lg w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="border-2 border-slate-200 rounded-xl p-6 mb-6 text-center bg-gradient-to-b from-slate-50 to-blue-50 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px' }} />
          <div className="relative">
            <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase mb-2">Certificate of Achievement</p>
            <IconTrophy className="text-3xl mb-3 mx-auto text-amber-500" size={32} stroke={1.5} />
            <h3 className="text-xl font-bold text-foreground mb-1">Winner</h3>
            <p className="text-sm text-muted-foreground mb-3">has won</p>
            <p className="text-lg font-bold text-slate-700 mb-2">{result.prize}</p>
            <p className="text-xs text-muted-foreground">Draw: {result.drawName}</p>
            <p className="text-xs text-muted-foreground">By: {result.organizer}</p>
            <p className="text-xs text-muted-foreground">Date: {result.announcedDate}</p>
            <div className="mt-4 pt-4 border-t border-primary/20">
              <p className="text-xs text-muted-foreground tracking-widest">VERIFIED & CERTIFIED</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button className="flex-1 bg-slate-900 text-white hover:bg-slate-800">↓ Download PDF</Button>
          <Button onClick={onClose} variant="outline" className="flex-1 border-primary/20">Close</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ResultDetailDrawer({ result, onClose, onClaim }: {
  result: Result;
  onClose: () => void;
  onClaim: (id: string) => void;
}) {
  const [showCert, setShowCert] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-full max-w-xl z-40 bg-card border-l border-primary/20 overflow-y-auto shadow-2xl"
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{result.drawName}</h2>
              <p className="text-sm text-muted-foreground">by {result.organizer}</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
          </div>

          {/* Description */}
          {result.drawDescription && (
            <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3">{result.drawDescription}</p>
          )}

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
              result.type === 'won' ? 'bg-slate-100 text-slate-700' :
              result.type === 'participated' ? 'bg-primary/20 text-primary' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              {result.type === 'won' && <IconStar size={12} stroke={2} />}{result.type.charAt(0).toUpperCase() + result.type.slice(1)}
            </span>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
              result.status === 'claimed' ? 'bg-primary/20 text-primary' :
              result.status === 'won' ? 'bg-slate-100 text-slate-700' :
              result.status === 'lost' ? 'bg-muted text-muted-foreground' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              {result.status === 'claimed' ? <IconCheck size={12} stroke={2} /> : result.status === 'won' ? <IconStar size={12} stroke={2} /> : result.status === 'lost' ? <IconX size={12} stroke={2} /> : <IconClock size={12} stroke={2} />}
              {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
            </span>
          </div>

          {/* Prize info */}
          {result.prize && (
            <div className="bg-background rounded-lg p-4 border border-slate-200 space-y-2">
              <p className="text-xs text-muted-foreground">Prize Awarded</p>
              <p className="text-lg font-bold text-slate-700">{result.prize}</p>
              {result.prizeValue && <p className="text-xs text-muted-foreground">Estimated value: {result.prizeValue}</p>}
            </div>
          )}

          {/* Credit info */}
          {result.status === 'won' && result.type === 'won' && result.prizeValue && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
              <p className="text-green-600 font-bold text-sm flex items-center justify-center gap-1">
                <IconCheck size={16} stroke={2} /> Prize Credited
              </p>
              <p className="text-xs text-muted-foreground mt-1">{result.prizeValue} added to your balance</p>
            </div>
          )}

          {/* Certificate */}
          {result.certificateAvailable && (
            <Button onClick={() => setShowCert(true)} variant="outline" className="w-full border-slate-200 text-slate-700 hover:bg-slate-50">
              <IconTrophy size={16} stroke={1.5} /> View & Download Certificate
            </Button>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background rounded-lg p-3 border border-primary/10">
              <p className="text-xs text-muted-foreground mb-1">Announced</p>
              <p className="text-sm font-mono font-bold text-primary">{result.announcedDate}</p>
            </div>
            {result.claimedDate && (
              <div className="bg-background rounded-lg p-3 border border-primary/10">
                <p className="text-xs text-muted-foreground mb-1">Claimed</p>
                <p className="text-sm font-mono font-bold text-slate-700">{result.claimedDate}</p>
              </div>
            )}
          </div>

          {/* Delivery Info */}
          {result.delivery && (
            <div className="bg-background rounded-lg p-4 border border-primary/10 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Prize Delivery</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Method</p>
                  <p className="capitalize font-medium">{result.delivery.method}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    result.delivery.status === 'confirmed' ? 'bg-primary/20 text-primary' :
                    result.delivery.status === 'delivered' ? 'bg-slate-100 text-slate-700' :
                    result.delivery.status === 'shipped' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {result.delivery.status.charAt(0).toUpperCase() + result.delivery.status.slice(1)}
                  </span>
                </div>
                {result.delivery.trackingId && (
                  <div>
                    <p className="text-xs text-muted-foreground">Tracking</p>
                    <p className="font-mono text-primary text-xs">{result.delivery.trackingId}</p>
                  </div>
                )}
                {result.delivery.estimatedDate && (
                  <div>
                    <p className="text-xs text-muted-foreground">Est. Delivery</p>
                    <p className="text-xs font-mono">{result.delivery.estimatedDate}</p>
                  </div>
                )}
                {result.delivery.confirmedAt && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Confirmed At</p>
                    <p className="font-mono text-xs text-slate-700">{result.delivery.confirmedAt}</p>
                  </div>
                )}
              </div>
              {result.delivery.notes && (
                <p className="text-xs text-muted-foreground border-t border-primary/10 pt-2">{result.delivery.notes}</p>
              )}
            </div>
          )}

          {/* Communication Log */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Messages from Organizer</h4>
            {result.communications.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-primary/20 rounded-lg">No messages yet.</p>
            ) : (
              <div className="space-y-2">
                {result.communications.map(comm => (
                  <div key={comm.id} className="bg-background rounded-lg p-3 border border-primary/10 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        comm.type === 'email' ? 'bg-blue-500/20 text-blue-400' :
                        comm.type === 'sms' ? 'bg-slate-100 text-slate-700' :
                        'bg-primary/20 text-primary'
                      }`}>
                        {comm.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground">{comm.fromOrganizer}</span>
                    </div>
                    <p className="text-xs text-foreground">{comm.message}</p>
                    <p className="text-xs text-muted-foreground font-mono">{new Date(comm.timestamp).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showCert && <CertificateModal result={result} onClose={() => setShowCert(false)} />}
      </AnimatePresence>
    </>
  );
}

export default function ResultsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [results, setResults] = useState<Result[]>([]);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const iconMap: Record<string, React.ComponentType<any>> = {
    ticket: IconTicket, star: IconStar, package: IconPackage, clock: IconClock, check: IconCheck, x: IconX,
  };

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'participant') router.push('/auth');
  }, [user, isLoading, router]);

  // Fetch results from API
  useEffect(() => {
    if (!user) return;
    const fetchResults = async () => {
      try {
        const entriesRes = await api<{ success: boolean; data: any[] }>(apiUrls.tokens.myEntries);
        const mapped: Result[] = (entriesRes.data || []).map((e: any) => {
          const isWinner = !!e.winner_id;
          return {
            id: e.id || `ent-${Math.random()}`,
            drawName: e.draw_title || 'Unknown Draw',
            organizer: 'Organizer',
            type: isWinner ? 'won' as const : 'participated' as const,
            status: isWinner
              ? (e.winner_status === 'claimed' ? 'claimed' as const : 'won' as const)
              : (e.draw_status === 'completed' ? 'lost' as const : 'pending' as const),
            prize: e.prize_title || (isWinner ? `Prize #${e.winner_rank}` : undefined),
            prizeValue: e.prize_value ? `$${e.prize_value}` : undefined,
            announcedDate: e.draw_status === 'completed' ? (e.draw_date?.split('T')[0] || '') : '',
            claimedDate: e.winner_status === 'claimed' ? undefined : undefined,
            winnerId: e.winner_id || undefined,
            winnerRank: e.winner_rank || undefined,
            verificationCode: e.verification_code || undefined,
            claimDeadline: e.claim_deadline || undefined,
            certificateAvailable: false,
            communications: [],
            delivery: isWinner ? { method: 'digital' as const, status: e.winner_status === 'claimed' ? 'confirmed' as const : 'pending' as const } : undefined,
          };
        });
        setResults(mapped);
      } catch {}
    };
    fetchResults();
  }, [user]);

  const filteredResults = results.filter(r =>
    filterType === 'all' || r.type === filterType
  );

  const totalPages = Math.ceil(filteredResults.length / PAGE_SIZE);
  const paginatedResults = filteredResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = [
    { label: 'Total Entries', value: results.length, icon: 'ticket' },
    { label: 'Wins', value: results.filter(r => r.status === 'won' || r.status === 'claimed').length, icon: 'star' },
    { label: 'Claimed', value: results.filter(r => r.status === 'claimed').length, icon: 'package' },
    { label: 'Pending', value: results.filter(r => r.status === 'pending').length, icon: 'clock' },
  ];

  const handleClaim = async (id: string) => {
    // No-op: prizes are automatically credited when the draw is executed
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">Results & History</h1>
            <p className="text-muted-foreground">View your participation history, prize claims, and certificates.</p>
          </motion.div>

          {/* Stats */}
          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-card border border-primary/20 rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">{stat.label}</p>
                  <span className="text-xl text-muted-foreground">{(() => { const Ic = iconMap[stat.icon]; return Ic ? <Ic size={20} stroke={1.5} /> : null; })()}</span>
                </div>
                <p className="text-3xl font-bold text-slate-700">{stat.value}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Filter */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex gap-2">
            {([
              { value: 'all' as const, label: 'All' },
              { value: 'won' as const, label: 'Won' },
              { value: 'participated' as const, label: 'Participated' },
              { value: 'upcoming' as const, label: 'Upcoming' },
            ]).map(filter => (
              <Button
                key={filter.value}
                onClick={() => { setFilterType(filter.value); setPage(1); }}
                variant={filterType === filter.value ? 'default' : 'outline'}
                className={filterType === filter.value ? 'bg-slate-900 text-white' : 'border-primary/20'}
                size="sm"
              >
                {filter.label}
              </Button>
            ))}
          </motion.div>

          {/* Results */}
          <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {paginatedResults.map((result, idx) => (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + idx * 0.05 }}
                className={`border rounded-lg p-6 transition-all duration-300 cursor-pointer ${
                  result.status === 'won' || result.status === 'claimed'
                    ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    : result.status === 'lost'
                      ? 'bg-background border-primary/10 hover:border-primary/20'
                      : 'bg-primary/5 border-primary/30 hover:border-primary/50'
                }`}
                onClick={() => setSelectedResult(result)}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left side */}
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{result.drawName}</h3>
                      <p className="text-sm text-muted-foreground">by {result.organizer}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        result.type === 'won' ? 'bg-slate-100 text-slate-700' :
                        result.type === 'participated' ? 'bg-primary/20 text-primary' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {result.type === 'won' && <IconStar size={12} stroke={2} />}{result.type.charAt(0).toUpperCase() + result.type.slice(1)}
                      </span>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        result.status === 'claimed' ? 'bg-primary/20 text-primary' :
                        result.status === 'won' ? 'bg-slate-100 text-slate-700' :
                        result.status === 'lost' ? 'bg-muted text-muted-foreground' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {result.status === 'claimed' ? <><IconCheck size={12} stroke={2} /> </> : result.status === 'won' ? <><IconStar size={12} stroke={2} /> </> : result.status === 'lost' ? <><IconX size={12} stroke={2} /> </> : <><IconClock size={12} stroke={2} /> </>}
                        {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                      </span>
                      {result.certificateAvailable && (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-700">
                          <IconTrophy size={12} stroke={2} /> Cert Available
                        </span>
                      )}
                    </div>

                    {result.prize && (
                      <div className="bg-background/50 rounded-lg p-3 border border-slate-200">
                        <p className="text-xs text-muted-foreground mb-1">Prize Awarded</p>
                        <p className="text-slate-700 font-bold">{result.prize}</p>
                        {result.prizeValue && <p className="text-xs text-muted-foreground">{result.prizeValue}</p>}
                      </div>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-background/50 rounded-lg p-3 border border-primary/10">
                        <p className="text-xs text-muted-foreground mb-1">Announced</p>
                        <p className="text-sm font-mono font-bold text-primary">{result.announcedDate}</p>
                      </div>
                      {result.claimedDate && (
                        <div className="bg-background/50 rounded-lg p-3 border border-primary/10">
                          <p className="text-xs text-muted-foreground mb-1">Claimed</p>
                          <p className="text-sm font-mono font-bold text-slate-700">{result.claimedDate}</p>
                        </div>
                      )}
                    </div>

                    {result.prizeValue && !result.prize && (
                      <div className="bg-background/50 rounded-lg p-3 border border-primary/10">
                        <p className="text-xs text-muted-foreground mb-1">Prize Value</p>
                        <p className="text-sm font-bold text-foreground">{result.prizeValue}</p>
                      </div>
                    )}

                    {/* Delivery status if available */}
                    {result.delivery && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Delivery:</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          result.delivery.status === 'confirmed' ? 'bg-primary/20 text-primary' :
                          result.delivery.status === 'delivered' ? 'bg-slate-100 text-slate-700' :
                          result.delivery.status === 'shipped' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          <IconPackage size={12} stroke={2} /> {result.delivery.status.charAt(0).toUpperCase() + result.delivery.status.slice(1)}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
                      {result.status === 'won' && result.prizeValue && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-600 border border-green-500/30">
                          <IconCheck size={12} stroke={2} /> Credited
                        </span>
                      )}
                      {result.certificateAvailable && (
                        <Button onClick={() => setSelectedResult(result)} className="flex-1 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200" variant="outline" size="sm">
                          <IconTrophy size={14} stroke={1.5} /> Certificate
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {totalPages > 1 && (
            <Pagination page={page} totalItems={filteredResults.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          )}

          {filteredResults.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 bg-card border border-primary/20 rounded-lg">
              <IconTicket className="mx-auto mb-4 text-muted-foreground" size={40} stroke={1} />
              <p className="text-muted-foreground mb-4">No {filterType === 'all' ? 'results' : filterType.toLowerCase()} found.</p>
              <Button onClick={() => setFilterType('all')} variant="outline" className="border-primary/20">View All</Button>
            </motion.div>
          )}

          {/* Footer */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Button onClick={() => router.back()} variant="outline" className="border-primary/20">Back to Dashboard</Button>
          </motion.div>
        </div>
      </main>

      {/* Result Detail Drawer */}
      <AnimatePresence>
        {selectedResult && (
          <ResultDetailDrawer
            result={selectedResult}
            onClose={() => setSelectedResult(null)}
            onClaim={handleClaim}
          />
        )}
      </AnimatePresence>
    </div>
  );
}