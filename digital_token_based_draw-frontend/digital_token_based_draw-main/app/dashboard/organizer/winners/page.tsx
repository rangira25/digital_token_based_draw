'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { Button } from '@/components/ui/button';
import { api, apiUrls } from '@/lib/api';
import { IconTrophy, IconChartBar, IconMail, IconPackage, IconCheck, IconStar, IconClock, IconCoin, IconShieldCheck, IconCircleCheck } from '@tabler/icons-react';
import { Pagination } from '@/components/Pagination';

interface CommunicationLog {
  id: string;
  type: 'email' | 'sms' | 'system';
  message: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
}

interface DeliveryConfirmation {
  method: 'digital' | 'physical' | 'in-person';
  trackingId?: string;
  confirmedAt?: string;
  status: 'pending' | 'shipped' | 'delivered' | 'confirmed';
  notes?: string;
}

interface Winner {
  id: string;
  name: string;
  email: string;
  phone?: string;
  drawName: string;
  prize: string;
  prizeValue?: string;
  claimedAt?: string;
  status: 'pending' | 'claimed' | 'verified';
  announcedDate: string;
  notified: boolean;
  notifiedAt?: string;
  certificateGenerated: boolean;
  certificateUrl?: string;
  communicationLog: CommunicationLog[];
  delivery: DeliveryConfirmation;
  participationHistory: { drawName: string; date: string; result: 'won' | 'participated' }[];
}

const mockWinners: Winner[] = [
  {
    id: 'w1',
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    phone: '+1 555-0101',
    drawName: 'Product Launch Giveaway',
    prize: 'MacBook Pro 16"',
    prizeValue: '$3,499',
    status: 'verified',
    claimedAt: '2026-05-12',
    announcedDate: '2026-05-12',
    notified: true,
    notifiedAt: '2026-05-12T09:00:00Z',
    certificateGenerated: true,
    certificateUrl: '/certs/w1.pdf',
    communicationLog: [
      { id: 'c1', type: 'email', message: 'Congratulations! You have won the Product Launch Giveaway.', timestamp: '2026-05-12T09:00:00Z', status: 'read' },
      { id: 'c2', type: 'email', message: 'Your prize claim has been verified. Shipping details incoming.', timestamp: '2026-05-12T14:00:00Z', status: 'delivered' },
    ],
    delivery: { method: 'physical', trackingId: 'TRK-9823', confirmedAt: '2026-05-15', status: 'delivered', notes: 'Delivered to front desk.' },
    participationHistory: [
      { drawName: 'Product Launch Giveaway', date: '2026-05-12', result: 'won' },
      { drawName: 'Beta Tester Q1', date: '2026-03-10', result: 'participated' },
    ],
  },
  {
    id: 'w2',
    name: 'Michael Rodriguez',
    email: 'michael.r@example.com',
    drawName: 'Product Launch Giveaway',
    prize: 'iPad Air',
    prizeValue: '$749',
    status: 'claimed',
    claimedAt: '2026-05-11',
    announcedDate: '2026-05-11',
    notified: true,
    notifiedAt: '2026-05-11T10:00:00Z',
    certificateGenerated: true,
    certificateUrl: '/certs/w2.pdf',
    communicationLog: [
      { id: 'c3', type: 'email', message: 'Congratulations! You won an iPad Air.', timestamp: '2026-05-11T10:00:00Z', status: 'read' },
    ],
    delivery: { method: 'physical', trackingId: 'TRK-4471', status: 'shipped', notes: 'In transit.' },
    participationHistory: [
      { drawName: 'Product Launch Giveaway', date: '2026-05-11', result: 'won' },
    ],
  },
  {
    id: 'w3',
    name: 'Alex Johnson',
    email: 'alex.j@example.com',
    drawName: 'Community Recognition',
    prize: '$500 Gift Card',
    prizeValue: '$500',
    status: 'pending',
    announcedDate: '2026-05-10',
    notified: false,
    certificateGenerated: false,
    communicationLog: [],
    delivery: { method: 'digital', status: 'pending' },
    participationHistory: [
      { drawName: 'Community Recognition', date: '2026-05-10', result: 'won' },
      { drawName: 'Spring Giveaway 2025', date: '2025-04-20', result: 'participated' },
    ],
  },
  {
    id: 'w4',
    name: 'Emma Wilson',
    email: 'emma.w@example.com',
    drawName: 'Product Launch Giveaway',
    prize: 'MacBook Pro 14"',
    prizeValue: '$1,999',
    status: 'verified',
    claimedAt: '2026-05-09',
    announcedDate: '2026-05-09',
    notified: true,
    notifiedAt: '2026-05-09T08:30:00Z',
    certificateGenerated: true,
    certificateUrl: '/certs/w4.pdf',
    communicationLog: [
      { id: 'c4', type: 'email', message: 'Congratulations, Emma! MacBook Pro 14" is yours.', timestamp: '2026-05-09T08:30:00Z', status: 'read' },
      { id: 'c5', type: 'sms', message: 'Your prize has been shipped. Tracking: TRK-3310', timestamp: '2026-05-10T11:00:00Z', status: 'delivered' },
    ],
    delivery: { method: 'physical', trackingId: 'TRK-3310', confirmedAt: '2026-05-13', status: 'confirmed', notes: 'Winner confirmed receipt via email.' },
    participationHistory: [
      { drawName: 'Product Launch Giveaway', date: '2026-05-09', result: 'won' },
      { drawName: 'Fall 2025 Giveaway', date: '2025-10-05', result: 'participated' },
      { drawName: 'Holiday Draw 2025', date: '2025-12-20', result: 'participated' },
    ],
  },
  {
    id: 'w5',
    name: 'David Park',
    email: 'david.park@example.com',
    drawName: 'Community Recognition',
    prize: '$500 Gift Card',
    prizeValue: '$500',
    status: 'pending',
    announcedDate: '2026-05-10',
    notified: true,
    notifiedAt: '2026-05-10T09:00:00Z',
    certificateGenerated: false,
    communicationLog: [
      { id: 'c6', type: 'email', message: 'Congratulations David! Claim your $500 gift card.', timestamp: '2026-05-10T09:00:00Z', status: 'sent' },
    ],
    delivery: { method: 'digital', status: 'pending' },
    participationHistory: [
      { drawName: 'Community Recognition', date: '2026-05-10', result: 'won' },
    ],
  },
];

type FilterStatus = 'all' | 'pending' | 'claimed' | 'verified';
type ActiveTab = 'list' | 'leaderboard' | 'analytics';

function CertificateModal({ winner, onClose }: { winner: Winner; onClose: () => void }) {
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
        {/* Certificate Preview */}
        <div className="border-2 border-slate-300 rounded-xl p-6 mb-6 text-center bg-gradient-to-b from-slate-50 to-blue-50 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px' }} />
          <div className="relative">
            <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase mb-2">Certificate of Achievement</p>
            <IconTrophy className="text-3xl mb-3 mx-auto text-amber-500" size={32} stroke={1.5} />
            <h3 className="text-xl font-bold text-foreground mb-1">{winner.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">has won</p>
            <p className="text-lg font-bold text-primary mb-2">{winner.prize}</p>
            <p className="text-xs text-muted-foreground">Draw: {winner.drawName}</p>
            <p className="text-xs text-muted-foreground">Date: {winner.announcedDate}</p>
            <div className="mt-4 pt-4 border-t border-primary/20">
              <p className="text-xs text-muted-foreground tracking-widest">VERIFIED & CERTIFIED</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
            ↓ Download PDF
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1 border-primary/20">
            Close
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function WinnerDetailDrawer({ winner, onClose, onMarkClaimed, onVerify, onSendNotification, onGenerateCert }: {
  winner: Winner;
  onClose: () => void;
  onMarkClaimed: (id: string) => void;
  onVerify: (id: string) => void;
  onSendNotification: (id: string) => void;
  onGenerateCert: (id: string) => void;
}) {
  const [showCert, setShowCert] = useState(false);
  const [newMessage, setNewMessage] = useState('');

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
              <h2 className="text-2xl font-bold text-foreground">{winner.name}</h2>
              <p className="text-sm text-muted-foreground font-mono">{winner.email}</p>
              {winner.phone && <p className="text-sm text-muted-foreground">{winner.phone}</p>}
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
          </div>

          {/* Status + Prize */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background rounded-lg p-3 border border-primary/10">
              <p className="text-xs text-muted-foreground mb-1">Prize</p>
              <p className="font-bold text-primary">{winner.prize}</p>
              {winner.prizeValue && <p className="text-xs text-muted-foreground">{winner.prizeValue}</p>}
            </div>
            <div className="bg-background rounded-lg p-3 border border-primary/10">
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                winner.status === 'verified' ? 'bg-primary/20 text-primary' :
                winner.status === 'claimed' ? 'bg-primary/20 text-primary' :
                'bg-muted text-muted-foreground'
              }`}>
                {winner.status.charAt(0).toUpperCase() + winner.status.slice(1)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            {!winner.notified && (
              <Button onClick={() => onSendNotification(winner.id)} size="sm" className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30" variant="outline">
                <IconMail size={14} stroke={1.5} /> Send Notification
              </Button>
            )}
            {winner.notified && !winner.certificateGenerated && (
              <Button onClick={() => onGenerateCert(winner.id)} size="sm" className="bg-primary/20 text-primary hover:bg-slate-200 border border-slate-200" variant="outline">
                <IconTrophy size={14} stroke={1.5} /> Generate Certificate
              </Button>
            )}
            {winner.certificateGenerated && (
              <Button onClick={() => setShowCert(true)} size="sm" className="bg-primary/20 text-primary hover:bg-slate-200 border border-slate-200" variant="outline">
                <IconTrophy size={14} stroke={1.5} /> View Certificate
              </Button>
            )}
            {winner.status === 'pending' && (
              <Button onClick={() => onMarkClaimed(winner.id)} size="sm" className="bg-slate-50 text-primary hover:bg-slate-100 border border-slate-200" variant="outline">
                <IconCheck size={14} stroke={1.5} /> Mark Claimed
              </Button>
            )}
            {(winner.status === 'pending' || winner.status === 'claimed') && (
              <Button onClick={() => onVerify(winner.id)} size="sm" className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20" variant="outline">
                <IconShieldCheck size={14} stroke={1.5} /> Verify
              </Button>
            )}
          </div>

          {/* Prize Delivery */}
          <div className="bg-background rounded-lg p-4 border border-primary/10 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Prize Delivery</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Method</p>
                <p className="capitalize font-medium">{winner.delivery.method}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Delivery Status</p>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                  winner.delivery.status === 'confirmed' ? 'bg-primary/20 text-primary' :
                  winner.delivery.status === 'delivered' ? 'bg-primary/20 text-primary' :
                  winner.delivery.status === 'shipped' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {winner.delivery.status.charAt(0).toUpperCase() + winner.delivery.status.slice(1)}
                </span>
              </div>
              {winner.delivery.trackingId && (
                <div>
                  <p className="text-xs text-muted-foreground">Tracking ID</p>
                  <p className="font-mono text-primary text-xs">{winner.delivery.trackingId}</p>
                </div>
              )}
              {winner.delivery.confirmedAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Confirmed At</p>
                  <p className="font-mono text-xs">{winner.delivery.confirmedAt}</p>
                </div>
              )}
            </div>
            {winner.delivery.notes && (
              <p className="text-xs text-muted-foreground border-t border-primary/10 pt-2">{winner.delivery.notes}</p>
            )}
          </div>

          {/* Communication Log */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Communication Log</h4>
            {winner.communicationLog.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-primary/20 rounded-lg">No communications yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {winner.communicationLog.map(log => (
                  <div key={log.id} className="bg-background rounded-lg p-3 border border-primary/10 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        log.type === 'email' ? 'bg-blue-500/20 text-blue-400' :
                        log.type === 'sms' ? 'bg-primary/20 text-primary' :
                        'bg-primary/20 text-primary'
                      }`}>
                        {log.type.toUpperCase()}
                      </span>
                      <span className={`text-xs ${
                        log.status === 'read' ? 'text-primary' :
                        log.status === 'delivered' ? 'text-primary' :
                        'text-muted-foreground'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="text-xs text-foreground">{log.message}</p>
                    <p className="text-xs text-muted-foreground font-mono">{new Date(log.timestamp).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-background border border-primary/20 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
              />
              <Button size="sm" className="bg-primary/20 text-primary hover:bg-primary/30" variant="outline">
                Send
              </Button>
            </div>
          </div>

          {/* Participation History */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Participation History</h4>
            <div className="space-y-2">
              {winner.participationHistory.map((entry, i) => (
                <div key={i} className="flex items-center justify-between bg-background rounded-lg p-3 border border-primary/10">
                  <div>
                    <p className="text-xs font-medium text-foreground">{entry.drawName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{entry.date}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    entry.result === 'won' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {entry.result === 'won' ? (<><IconStar size={12} stroke={1.5} /> Won</>) : 'Participated'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Notification tracking */}
          <div className="bg-background rounded-lg p-4 border border-primary/10">
            <h4 className="text-sm font-semibold text-foreground mb-2">Notification Status</h4>
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${winner.notified ? 'bg-primary' : 'bg-muted-foreground'}`} />
              <div>
                <p className="text-xs font-medium">{winner.notified ? 'Notified' : 'Not Yet Notified'}</p>
                {winner.notifiedAt && (
                  <p className="text-xs text-muted-foreground font-mono">{new Date(winner.notifiedAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showCert && <CertificateModal winner={winner} onClose={() => setShowCert(false)} />}
      </AnimatePresence>
    </>
  );
}

function Analytics({ winners }: { winners: Winner[] }) {
  const iconMap: Record<string, React.ComponentType<any>> = {
    coin: IconCoin, 'chart-bar': IconChartBar, mail: IconMail, package: IconPackage,
  };

  const totalPrizeValue = winners.reduce((sum, w) => {
    const val = parseFloat((w.prizeValue || '$0').replace(/[^0-9.]/g, ''));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const byDraw = winners.reduce((acc, w) => {
    acc[w.drawName] = (acc[w.drawName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const claimRate = Math.round((winners.filter(w => w.status !== 'pending').length / winners.length) * 100);
  const notifRate = Math.round((winners.filter(w => w.notified).length / winners.length) * 100);
  const deliveryConfirmed = winners.filter(w => w.delivery.status === 'confirmed' || w.delivery.status === 'delivered').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Prize Value', value: `$${totalPrizeValue.toLocaleString()}`, icon: 'coin' },
          { label: 'Claim Rate', value: `${claimRate}%`, icon: 'chart-bar' },
          { label: 'Notification Rate', value: `${notifRate}%`, icon: 'mail' },
          { label: 'Delivery Confirmed', value: `${deliveryConfirmed}/${winners.length}`, icon: 'package' },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-primary/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <span>{(() => { const Ic = iconMap[stat.icon]; return Ic ? <Ic size={18} stroke={1.5} /> : null; })()}</span>
            </div>
            <p className="text-2xl font-bold text-primary">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-primary/20 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Winners by Draw</h3>
        <div className="space-y-3">
          {Object.entries(byDraw).map(([draw, count]) => (
            <div key={draw} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">{draw}</span>
                <span className="text-muted-foreground">{count} winner{count > 1 ? 's' : ''}</span>
              </div>
              <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(count / winners.length) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-slate-300 rounded-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-primary/20 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Status Breakdown</h3>
        <div className="space-y-3">
          {(['verified', 'claimed', 'pending'] as const).map(status => {
            const count = winners.filter(w => w.status === status).length;
            return (
              <div key={status} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="capitalize text-foreground">{status}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / winners.length) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      status === 'verified' ? 'bg-primary' :
                      status === 'claimed' ? 'bg-slate-300' : 'bg-muted-foreground'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Leaderboard({ winners }: { winners: Winner[] }) {
  const participantStats = winners.reduce((acc, w) => {
    if (!acc[w.name]) acc[w.name] = { name: w.name, email: w.email, wins: 0, totalValue: 0 };
    acc[w.name].wins++;
    const val = parseFloat((w.prizeValue || '$0').replace(/[^0-9.]/g, ''));
    if (!isNaN(val)) acc[w.name].totalValue += val;
    return acc;
  }, {} as Record<string, { name: string; email: string; wins: number; totalValue: number }>);

  const sorted = Object.values(participantStats).sort((a, b) => b.totalValue - a.totalValue);

  return (
    <div className="bg-card border border-primary/20 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-primary/10">
        <h3 className="font-semibold text-foreground">Winner Leaderboard</h3>
        <p className="text-xs text-muted-foreground">Ranked by total prize value</p>
      </div>
      <div className="divide-y divide-primary/10">
        {sorted.map((entry, idx) => (
          <motion.div
            key={entry.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-center gap-4 p-4 hover:bg-primary/5 transition-colors"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
              idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
              idx === 1 ? 'bg-slate-400/20 text-slate-400' :
              idx === 2 ? 'bg-amber-700/20 text-amber-600' :
              'bg-primary/10 text-muted-foreground'
            }`}>
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{entry.name}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">{entry.email}</p>
            </div>
            <div className="text-right">
              <p className="text-primary font-bold">${entry.totalValue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{entry.wins} win{entry.wins > 1 ? 's' : ''}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function WinnersPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [winners, setWinners] = useState<Winner[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [activeTab, setActiveTab] = useState<ActiveTab>('list');
  const [selectedWinner, setSelectedWinner] = useState<Winner | null>(null);
  const [apiError, setApiError] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const iconMap: Record<string, React.ComponentType<any>> = {
    star: IconStar, clock: IconClock, check: IconCheck, coin: IconCoin,
    'chart-bar': IconChartBar, mail: IconMail, package: IconPackage, trophy: IconTrophy,
  };

  useEffect(() => {
    if (isLoading) return;
    if (!user || (user.role !== 'organizer' && user.role !== 'admin')) router.push('/auth');
  }, [user, isLoading, router]);

  // Fetch winners from API
  useEffect(() => {
    if (!user) return;
    const fetchWinners = async () => {
      try {
        const res = await api<{ success: boolean; data: any[] }>(apiUrls.winners.list);
        const mapped: Winner[] = (res.data || []).map((w: any, idx: number) => ({
          id: w.id || `w${idx}`,
          name: w.users?.name || w.participant_name || 'Unknown',
          email: w.users?.email || '',
          drawName: w.draws?.title || 'Draw',
          prize: w.prize_title || `Prize #${w.rank || 1}`,
          prizeValue: w.prize_value ? `$${w.prize_value}` : undefined,
          status: w.claim_status === 'verified' ? 'verified' : w.claim_status === 'claimed' ? 'claimed' : 'pending',
          claimedAt: w.claimed_at?.split('T')[0] || undefined,
          announcedDate: w.won_at?.split('T')[0] || w.created_at?.split('T')[0] || '',
          notified: !!w.notified_at,
          notifiedAt: w.notified_at || undefined,
          certificateGenerated: false,
          communicationLog: [],
          delivery: { method: 'digital', status: w.claim_status === 'claimed' ? 'confirmed' : 'pending' },
          participationHistory: [],
        }));
        setWinners(mapped);
      } catch {}
    };
    fetchWinners();
  }, [user]);

  const filteredWinners = useMemo(() => winners.filter(w =>
    filterStatus === 'all' || w.status === filterStatus
  ), [winners, filterStatus]);

  const paginatedWinners = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredWinners.slice(start, start + PAGE_SIZE);
  }, [filteredWinners, page]);

  useEffect(() => { setPage(1); }, [filterStatus]);

  const stats = [
    { label: 'Total Winners', value: winners.length, icon: 'star' },
    { label: 'Pending Claims', value: winners.filter(w => w.status === 'pending').length, icon: 'clock' },
    { label: 'Claimed', value: winners.filter(w => w.status === 'claimed').length, icon: 'check' },
    { label: 'Verified', value: winners.filter(w => w.status === 'verified').length, icon: 'check' },
  ];

  const handleMarkClaimed = async (id: string) => {
    setApiError('');
    try {
      await api(apiUrls.winners.updateStatus(id), { method: 'PATCH', body: JSON.stringify({ claim_status: 'claimed' }) });
      setWinners(prev => prev.map(w =>
        w.id === id ? { ...w, status: 'claimed', claimedAt: new Date().toISOString().split('T')[0] } : w
      ));
      setSelectedWinner(prev => prev?.id === id ? { ...prev, status: 'claimed', claimedAt: new Date().toISOString().split('T')[0] } : prev);
    } catch (err: any) { setApiError(err.message); }
  };

  const handleVerifyWinner = async (id: string) => {
    setApiError('');
    try {
      await api(apiUrls.winners.updateStatus(id), { method: 'PATCH', body: JSON.stringify({ claim_status: 'verified' }) });
      setWinners(prev => prev.map(w => w.id === id ? { ...w, status: 'verified' } : w));
      setSelectedWinner(prev => prev?.id === id ? { ...prev, status: 'verified' } : prev);
    } catch (err: any) { setApiError(err.message); }
  };

  const handleSendNotification = (id: string) => {
    const now = new Date().toISOString();
    setWinners(prev => prev.map(w =>
      w.id === id ? {
        ...w,
        notified: true,
        notifiedAt: now,
        communicationLog: [...w.communicationLog, {
          id: `c${Date.now()}`,
          type: 'email' as const,
          message: `Congratulations! You have won ${w.prize} in ${w.drawName}.`,
          timestamp: now,
          status: 'sent' as const,
        }]
      } : w
    ));
    setSelectedWinner(prev => prev?.id === id ? {
      ...prev, notified: true, notifiedAt: now,
      communicationLog: [...prev.communicationLog, {
        id: `c${Date.now()}`, type: 'email', message: `Notification sent for ${prev.prize}.`, timestamp: now, status: 'sent'
      }]
    } : prev);
  };

  const handleGenerateCert = (id: string) => {
    setWinners(prev => prev.map(w =>
      w.id === id ? { ...w, certificateGenerated: true, certificateUrl: `/certs/${id}.pdf` } : w
    ));
    setSelectedWinner(prev => prev?.id === id ? { ...prev, certificateGenerated: true, certificateUrl: `/certs/${id}.pdf` } : prev);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">Winners Management</h1>
            <p className="text-muted-foreground">Track and manage prize claims, notifications, and verifications.</p>
          </motion.div>

          {apiError && (
            <div className="bg-destructive/10 border border-destructive/40 text-destructive text-sm p-3 rounded">{apiError}</div>
          )}

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
                <p className="text-3xl font-bold text-primary">{stat.value}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Tabs */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex gap-1 bg-card border border-primary/20 rounded-lg p-1 w-fit">
            {(['list', 'leaderboard', 'analytics'] as ActiveTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </motion.div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'list' && (
              <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                {/* Filter */}
                <div className="flex gap-2">
                  {(['all', 'pending', 'claimed', 'verified'] as FilterStatus[]).map(status => (
                    <Button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      variant={filterStatus === status ? 'default' : 'outline'}
                      className={filterStatus === status ? 'bg-primary text-primary-foreground' : 'border-primary/20'}
                      size="sm"
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Button>
                  ))}
                </div>

                {/* Winners List */}
                <div className="space-y-4">
                  {paginatedWinners.map((winner, idx) => (
                    <motion.div
                      key={winner.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-card border border-primary/20 rounded-lg p-6 hover:border-primary/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedWinner(winner)}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left side */}
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-lg font-bold text-foreground">{winner.name}</h3>
                            <p className="text-sm text-muted-foreground font-mono">{winner.email}</p>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Draw</p>
                              <p className="text-primary font-medium">{winner.drawName}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Prize</p>
                              <p className="text-primary font-bold">{winner.prize}</p>
                              {winner.prizeValue && <p className="text-xs text-muted-foreground">{winner.prizeValue}</p>}
                            </div>
                          </div>
                        </div>

                        {/* Right side */}
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Announced</p>
                              <p className="text-sm font-mono">{winner.announcedDate}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Status</p>
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                winner.status === 'verified' ? 'bg-primary/20 text-primary' :
                                winner.status === 'claimed' ? 'bg-primary/20 text-primary' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {winner.status.charAt(0).toUpperCase() + winner.status.slice(1)}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${winner.notified ? 'bg-blue-500/20 text-blue-400' : 'bg-muted text-muted-foreground'}`}>
                              {winner.notified ? <><IconMail size={12} stroke={1.5} /> Notified</> : <><IconMail size={12} stroke={1.5} /> Not Notified</>}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${winner.certificateGenerated ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              {winner.certificateGenerated ? <><IconTrophy size={12} stroke={1.5} /> Cert Ready</> : <><IconTrophy size={12} stroke={1.5} /> No Cert</>}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              winner.delivery.status === 'confirmed' ? 'bg-primary/20 text-primary' :
                              winner.delivery.status === 'delivered' ? 'bg-primary/20 text-primary' :
                              winner.delivery.status === 'shipped' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              <IconPackage size={12} stroke={1.5} /> {winner.delivery.status.charAt(0).toUpperCase() + winner.delivery.status.slice(1)}
                            </span>
                          </div>

                          <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
                            {winner.status === 'pending' && (
                              <>
                                <Button onClick={() => handleMarkClaimed(winner.id)} className="flex-1 bg-primary/20 text-primary hover:bg-slate-200" variant="outline" size="sm">
                                  Mark Claimed
                                </Button>
                                <Button onClick={() => handleVerifyWinner(winner.id)} className="flex-1 bg-primary/20 text-primary hover:bg-primary/30" variant="outline" size="sm">
                                  Verify Now
                                </Button>
                              </>
                            )}
                            {winner.status === 'claimed' && (
                              <Button onClick={() => handleVerifyWinner(winner.id)} className="flex-1 bg-primary/20 text-primary hover:bg-primary/30" variant="outline" size="sm">
                                Verify
                              </Button>
                            )}
                            {winner.status === 'verified' && (
                              <div className="flex-1 flex items-center justify-center py-2 bg-primary/10 rounded text-xs text-primary font-medium">
                                <IconCircleCheck size={12} stroke={2} /> Verified
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {filteredWinners.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 bg-card border border-primary/20 rounded-lg">
                    <p className="text-muted-foreground mb-4">No winners with this status.</p>
                    <Button onClick={() => setFilterStatus('all')} variant="outline" className="border-primary/20">View All</Button>
                  </motion.div>
                )}
                <Pagination page={page} totalItems={filteredWinners.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
              </motion.div>
            )}

            {activeTab === 'leaderboard' && (
              <motion.div key="leaderboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Leaderboard winners={winners} />
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Analytics winners={winners} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Export */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex gap-4">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              Export Winners List
            </Button>
            <Button onClick={() => router.back()} variant="outline" className="border-primary/20">
              Back to Dashboard
            </Button>
          </motion.div>
        </div>
      </main>

      {/* Winner Detail Drawer */}
      <AnimatePresence>
        {selectedWinner && (
          <WinnerDetailDrawer
            winner={selectedWinner}
            onClose={() => setSelectedWinner(null)}
            onMarkClaimed={handleMarkClaimed}
            onVerify={handleVerifyWinner}
            onSendNotification={handleSendNotification}
            onGenerateCert={handleGenerateCert}
          />
        )}
      </AnimatePresence>
    </div>
  );
}