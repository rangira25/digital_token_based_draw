'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, apiUrls, ApiError } from '@/lib/api';
import { exportExcel, exportPDF, type ExportColumn } from '@/lib/export';
import { IconCash, IconPackage, IconTicket, IconStar, IconKey, IconShieldLock, IconClipboardList, IconPencil, IconReceipt, IconTarget, IconPlayerPlay, IconPlayerStop, IconAtom, IconX, IconClipboard, IconCircleCheck, IconCheck } from '@tabler/icons-react';
import { Pagination } from '@/components/Pagination';

// ─── Types ────────────────────────────────────────────────────────────────────

type DrawStatus    = 'draft' | 'active' | 'closed' | 'completed';
type Algorithm     = 'crypto' | 'fisher-yates' | 'mersenne';
type PrizeCategory = 'cash' | 'product' | 'voucher' | 'experience' | 'license';
type ModalView     = 'create' | 'edit' | 'duplicate' | 'calendar' | 'history' | 'export' | null;
type EntryType     = 'free' | 'token' | 'paid';
type AgeGroup      = '18+' | '21+' | 'all';

interface PrizeTier {
  rank: number;
  label: string;
  description: string;
  value: number;
  quantity: number;
  category: PrizeCategory;
  claimDeadlineDays: number;
}

interface EligibilityCriteria {
  minAge: AgeGroup;
  requiresVerifiedId: boolean;
  requiresVerifiedEmail: boolean;
  allowedRegions: string;
  otherRequirements: string;
}

interface DrawConfig {
  // Basic
  name: string;
  description: string;
  rules: string;
  terms: string;
  // Dates
  startDate: string;
  endDate: string;
  drawDate: string;
  // Entry
  entryType: EntryType;
  tokenPrice: number;
  entryLimitPerParticipant: number;
  maxParticipants: number;
  // Status
  initialStatus: 'open' | 'draft';
  // Prize
  prizes: PrizeTier[];
  // Algorithm
  algorithm: Algorithm;
  allowTies: boolean;
  winnersCount: number;
  // Eligibility
  eligibility: EligibilityCriteria;
  // Flags
  testMode: boolean;
  isTemplate: boolean;
  templateName: string;
}

interface Draw extends DrawConfig {
  id: string;
  status: DrawStatus;
  participants: number;
  createdAt: string;
  updatedAt: string;
  result?: { executedAt: string; seed: string; winners: { rank: number; name: string; tokenId: string }[] };
  history: { executedAt: string; winnersCount: number }[];
  sourceTemplateId?: string;
}

// ─── Default/Empty Config ─────────────────────────────────────────────────────

function emptyConfig(): DrawConfig {
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  return {
    name: '',
    description: '',
    rules: '1. One entry per participant unless additional tokens are purchased.\n2. Winners will be selected by a cryptographically secure algorithm.\n3. Prizes must be claimed within the deadline.',
    terms: 'By entering this draw, participants agree to the organizer\'s terms and conditions. Void where prohibited.',
    startDate: today,
    endDate: nextWeek,
    drawDate: twoWeeks,
    entryType: 'free',
    tokenPrice: 0,
    entryLimitPerParticipant: 10,
    maxParticipants: 1000,
    initialStatus: 'open',
    prizes: [
      { rank: 1, label: '1st Place', description: 'Grand Prize', value: 500, quantity: 1, category: 'cash', claimDeadlineDays: 14 },
    ],
    algorithm: 'crypto',
    allowTies: false,
    winnersCount: 1,
    eligibility: { minAge: '18+', requiresVerifiedId: true, requiresVerifiedEmail: true, allowedRegions: 'Worldwide', otherRequirements: '' },
    testMode: false,
    isTemplate: false,
    templateName: '',
  };
}

// ─── Mock Templates ───────────────────────────────────────────────────────────

const MOCK_TEMPLATES: (DrawConfig & { id: string; templateName: string })[] = [
  {
    ...emptyConfig(),
    id: 'T001',
    templateName: 'Standard Giveaway',
    name: '',
    description: 'A standard product giveaway with 3 prize tiers.',
    winnersCount: 3,
    prizes: [
      { rank: 1, label: '1st Place', description: 'Grand Prize', value: 500, quantity: 1, category: 'cash', claimDeadlineDays: 14 },
      { rank: 2, label: '2nd Place', description: '2nd Prize', value: 200, quantity: 1, category: 'voucher', claimDeadlineDays: 14 },
      { rank: 3, label: '3rd Place', description: '3rd Prize', value: 100, quantity: 1, category: 'voucher', claimDeadlineDays: 14 },
    ],
    isTemplate: true,
  },
  {
    ...emptyConfig(),
    id: 'T002',
    templateName: 'Paid Token Draw',
    name: '',
    description: 'A paid-entry draw with token pricing.',
    entryType: 'paid',
    tokenPrice: 5,
    entryLimitPerParticipant: 5,
    prizes: [
      { rank: 1, label: 'Winner', description: 'Cash Prize', value: 1000, quantity: 1, category: 'cash', claimDeadlineDays: 7 },
    ],
    isTemplate: true,
  },
];
// ─── Constants ────────────────────────────────────────────────────────────────

const categoryIcon: Record<PrizeCategory, string> = { cash: 'cash', product: 'package', voucher: 'ticket', experience: 'star', license: 'key' };
const STATUS_FLOW: DrawStatus[] = ['draft', 'active', 'closed', 'completed'];

const statusConfig: Record<DrawStatus, { color: string; bg: string; dot: string; next?: DrawStatus; nextLabel?: string }> = {
  draft:     { color: 'text-slate-600',   bg: 'bg-slate-100 border-slate-200',     dot: 'bg-slate-400',   next: 'active',    nextLabel: 'Publish' },
  active:    { color: 'text-[#3BB82E]',   bg: 'bg-[#3BB82E]/10 border-[#3BB82E]/30', dot: 'bg-[#3BB82E]', next: 'closed',    nextLabel: 'Close Entries' },
  closed:    { color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',       dot: 'bg-amber-500',  next: 'completed', nextLabel: 'Draw Winners' },
  completed: { color: 'text-[#3BB82E]',   bg: 'bg-[#3BB82E]/10 border-[#3BB82E]/30', dot: 'bg-[#3BB82E]' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DrawStatus }) {
  const c = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function AlgorithmBadge({ algo }: { algo: Algorithm }) {
  const map: Record<Algorithm, { label: string; color: string }> = {
    'crypto':       { label: 'Crypto',       color: 'text-green-400'  },
    'fisher-yates': { label: 'Fisher-Yates', color: 'text-blue-400'   },
    'mersenne':     { label: 'Mersenne',      color: 'text-purple-400' },
  };
  return <span className={`text-xs font-mono ${map[algo].color}`}>{map[algo].label}</span>;
}

// ─── Draw Form (shared by Create / Edit) ─────────────────────────────────────

function DrawForm({
  config,
  onChange,
}: {
  config: DrawConfig;
  onChange: (c: DrawConfig) => void;
}) {
  const set = (field: keyof DrawConfig, value: unknown) => onChange({ ...config, [field]: value });
  const setElig = (field: keyof EligibilityCriteria, value: unknown) =>
    onChange({ ...config, eligibility: { ...config.eligibility, [field]: value } });

  const [tab, setTab] = useState<'basic' | 'entry' | 'prizes' | 'eligibility' | 'rules'>('basic');

  const tabs = [
    { id: 'basic' as const,       label: 'Basic' },
    { id: 'entry' as const,       label: 'Entry' },
    { id: 'prizes' as const,      label: 'Prizes' },
    { id: 'eligibility' as const, label: 'Eligibility' },
    { id: 'rules' as const,       label: 'Rules' },
  ];

  const addPrize = () => {
    const rank = config.prizes.length + 1;
    set('prizes', [...config.prizes, {
      rank, label: `${rank}${rank===1?'st':rank===2?'nd':rank===3?'rd':'th'} Place`,
      description: '', value: 0, quantity: 1, category: 'voucher' as PrizeCategory, claimDeadlineDays: 14,
    }]);
  };
  const removePrize = (rank: number) => set('prizes', config.prizes.filter(p => p.rank !== rank));
  const updatePrize = (rank: number, field: keyof PrizeTier, value: string | number) =>
    set('prizes', config.prizes.map(p => p.rank === rank ? { ...p, [field]: value } : p));

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-primary/10 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors -mb-px ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Basic Tab */}
      {tab === 'basic' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Draw Name *</label>
            <Input value={config.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Summer Giveaway 2026" className="border-primary/20 bg-background text-foreground" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <textarea value={config.description} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="Briefly describe this draw…"
              className="w-full border border-primary/20 bg-background text-foreground rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:border-slate-400" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Date</label>
              <Input type="date" value={config.startDate} onChange={e => set('startDate', e.target.value)}
                className="border-primary/20 bg-background text-foreground text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">End Date</label>
              <Input type="date" value={config.endDate} onChange={e => set('endDate', e.target.value)}
                className="border-primary/20 bg-background text-foreground text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Draw Date</label>
              <Input type="date" value={config.drawDate} onChange={e => set('drawDate', e.target.value)}
                className="border-primary/20 bg-background text-foreground text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Number of Winners</label>
              <Input type="number" min="1" value={config.winnersCount}
                onChange={e => set('winnersCount', parseInt(e.target.value) || 1)}
                className="border-primary/20 bg-background text-foreground" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Max Participants</label>
              <Input type="number" min="1" value={config.maxParticipants}
                onChange={e => set('maxParticipants', parseInt(e.target.value) || 1)}
                className="border-primary/20 bg-background text-foreground" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Initial Status</label>
            <div className="flex gap-2">
              {(['open', 'draft'] as const).map(s => (
                <button key={s} type="button" onClick={() => set('initialStatus', s)}
                  className={`px-4 py-2 rounded-lg border text-xs font-medium transition-all ${
                    config.initialStatus === s
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-primary/20 text-muted-foreground hover:text-foreground'
                  }`}>
                  {s === 'open' ? 'Open (visible to participants)' : 'Draft (only you can see)'}
                </button>
              ))}
            </div>
          </div>
          {/* Algorithm */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground block">Randomization Algorithm</label>
            <div className="grid grid-cols-3 gap-2">
              {(['crypto', 'fisher-yates', 'mersenne'] as Algorithm[]).map(a => (
                <button key={a} type="button" onClick={() => set('algorithm', a)}
                  className={`p-2.5 rounded-lg border-2 text-left transition-all ${config.algorithm === a ? 'border-slate-900 bg-slate-900' : 'border-primary/20 hover:border-primary/40'}`}>
                  <AlgorithmBadge algo={a} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={config.allowTies} onChange={e => set('allowTies', e.target.checked)} className="accent-accent" />
              <span className="text-sm text-foreground">Allow ties</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={config.testMode} onChange={e => set('testMode', e.target.checked)} className="accent-accent" />
              <span className="text-sm text-foreground flex items-center gap-1.5"><IconAtom size={16} stroke={1.5} /> Test mode</span>
            </label>
          </div>
          {/* Save as template */}
          <div className="bg-muted/20 border border-primary/10 rounded-lg p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={config.isTemplate} onChange={e => set('isTemplate', e.target.checked)} className="accent-accent" />
              <span className="text-sm text-foreground font-medium">Save as reusable template</span>
            </label>
            {config.isTemplate && (
              <Input value={config.templateName} onChange={e => set('templateName', e.target.value)}
                placeholder="Template name (e.g. Standard Giveaway)"
                className="border-primary/20 bg-background text-foreground text-sm" />
            )}
          </div>
        </div>
      )}

      {/* Entry Tab */}
      {tab === 'entry' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground block">Entry Type</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'free',  label: 'Free Entry',   desc: 'Anyone can enter' },
                { value: 'token', label: 'Token Entry',  desc: 'Requires a token' },
                { value: 'paid',  label: 'Paid Entry',   desc: 'Requires payment' },
              ] as { value: EntryType; label: string; desc: string }[]).map(et => (
                <button key={et.value} type="button" onClick={() => set('entryType', et.value)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${config.entryType === et.value ? 'border-slate-900 bg-slate-900' : 'border-primary/20 hover:border-primary/40'}`}>
                  <p className="text-xs font-semibold text-white">{et.label}</p>
                  <p className="text-xs text-white/60 mt-0.5">{et.desc}</p>
                </button>
              ))}
            </div>
          </div>
          {config.entryType === 'paid' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Token Price (USD)</label>
              <Input type="number" min="0" step="0.01" value={config.tokenPrice}
                onChange={e => set('tokenPrice', parseFloat(e.target.value) || 0)}
                className="border-primary/20 bg-background text-foreground" />
              <p className="text-xs text-muted-foreground mt-1">Cost per entry token</p>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Entry Limit Per Participant</label>
            <Input type="number" min="1" value={config.entryLimitPerParticipant}
              onChange={e => set('entryLimitPerParticipant', parseInt(e.target.value) || 1)}
              className="border-primary/20 bg-background text-foreground" />
            <p className="text-xs text-muted-foreground mt-1">Max tokens/entries a single participant can use</p>
          </div>
        </div>
      )}

      {/* Prizes Tab */}
      {tab === 'prizes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Configure prize tiers for each rank</p>
            <button onClick={addPrize} className="text-xs text-slate-700 hover:text-slate-600 font-medium">+ Add tier</button>
          </div>
          {config.prizes.map(tier => (
            <div key={tier.rank} className="bg-muted/20 border border-primary/10 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 w-5">#{tier.rank}</span>
                <Input value={tier.label} onChange={e => updatePrize(tier.rank, 'label', e.target.value)}
                  placeholder="Label" className="border-primary/20 bg-background text-foreground h-7 text-xs flex-1" />
                {config.prizes.length > 1 && (
                  <button onClick={() => removePrize(tier.rank)} className="text-destructive/60 hover:text-destructive text-sm shrink-0"><IconX size={14} stroke={1.5} /></button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={tier.description} onChange={e => updatePrize(tier.rank, 'description', e.target.value)}
                  placeholder="Description" className="border-primary/20 bg-background text-foreground h-7 text-xs" />
                <div className="flex gap-1">
                  <span className="text-xs text-muted-foreground self-center">$</span>
                  <Input type="number" value={tier.value} onChange={e => updatePrize(tier.rank, 'value', Number(e.target.value))}
                    className="border-primary/20 bg-background text-foreground h-7 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={tier.category} onChange={e => updatePrize(tier.rank, 'category', e.target.value)}
                  className="bg-background border border-primary/20 rounded-md px-2 py-1 text-xs text-foreground focus:outline-none">
                  <option value="cash">Cash</option>
                  <option value="product">Product</option>
                  <option value="voucher">Voucher</option>
                  <option value="experience">Experience</option>
                  <option value="license">License</option>
                </select>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Qty:</span>
                  <Input type="number" min="1" value={tier.quantity} onChange={e => updatePrize(tier.rank, 'quantity', Number(e.target.value))}
                    className="border-primary/20 bg-background text-foreground h-7 text-xs" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Claim deadline (days):</span>
                <Input type="number" min="1" value={tier.claimDeadlineDays} onChange={e => updatePrize(tier.rank, 'claimDeadlineDays', Number(e.target.value))}
                  className="border-primary/20 bg-background text-foreground h-7 text-xs w-20" />
              </div>
            </div>
          ))}
          {config.prizes.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
              <span className="text-muted-foreground">Total prize pool: </span>
              <span className="text-slate-700 font-bold">${config.prizes.reduce((s, p) => s + p.value * p.quantity, 0).toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Eligibility Tab */}
      {tab === 'eligibility' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Minimum Age</label>
            <div className="flex gap-2">
              {(['all', '18+', '21+'] as AgeGroup[]).map(a => (
                <button key={a} type="button" onClick={() => setElig('minAge', a)}
                  className={`px-4 py-2 rounded-lg border text-xs font-medium transition-all ${config.eligibility.minAge === a ? 'border-slate-900 bg-slate-900 text-white' : 'border-primary/20 text-muted-foreground hover:text-foreground'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Allowed Regions</label>
            <Input value={config.eligibility.allowedRegions} onChange={e => setElig('allowedRegions', e.target.value)}
              placeholder="e.g. Worldwide, US only, EU only…" className="border-primary/20 bg-background text-foreground" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground block">Requirements</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={config.eligibility.requiresVerifiedId}
                onChange={e => setElig('requiresVerifiedId', e.target.checked)} className="accent-accent" />
              <span className="text-sm text-foreground">Verified government ID required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={config.eligibility.requiresVerifiedEmail}
                onChange={e => setElig('requiresVerifiedEmail', e.target.checked)} className="accent-accent" />
              <span className="text-sm text-foreground">Verified email required</span>
            </label>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Other Requirements</label>
            <textarea value={config.eligibility.otherRequirements}
              onChange={e => setElig('otherRequirements', e.target.value)}
              rows={2} placeholder="Any additional eligibility criteria…"
              className="w-full border border-primary/20 bg-background text-foreground rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:border-slate-400" />
          </div>
        </div>
      )}

      {/* Rules & Terms Tab */}
      {tab === 'rules' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Draw Rules</label>
            <textarea value={config.rules} onChange={e => set('rules', e.target.value)} rows={5}
              className="w-full border border-primary/20 bg-background text-foreground rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:border-slate-400 font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Terms & Conditions</label>
            <textarea value={config.terms} onChange={e => set('terms', e.target.value)} rows={4}
              className="w-full border border-primary/20 bg-background text-foreground rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:border-slate-400" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({ draws }: { draws: Draw[] }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear,  setViewYear]  = useState(today.getFullYear());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();

  const monthName = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

  const eventsOnDay = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events: { label: string; type: 'start' | 'end' | 'draw'; status: DrawStatus }[] = [];
    draws.forEach(d => {
      if (d.startDate === dateStr) events.push({ label: d.name, type: 'start', status: d.status });
      if (d.endDate === dateStr)   events.push({ label: d.name, type: 'end',   status: d.status });
      if (d.drawDate === dateStr)  events.push({ label: d.name, type: 'draw',  status: d.status });
    });
    return events;
  };

  const eventColor = (type: 'start' | 'end' | 'draw') => ({
    start: 'bg-green-500/20 text-green-400',
    end:   'bg-yellow-500/20 text-yellow-400',
    draw:  'bg-slate-100 text-slate-700',
  }[type]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Draw Calendar</h2>
        <button className="text-muted-foreground hover:text-foreground text-xl" onClick={() => {}}>×</button>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }}
          className="text-muted-foreground hover:text-foreground px-3 py-1 rounded border border-primary/20">←</button>
        <p className="font-semibold text-foreground">{monthName}</p>
        <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }}
          className="text-muted-foreground hover:text-foreground px-3 py-1 rounded border border-primary/20">→</button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        {[{ label: 'Start', color: 'bg-green-500' }, { label: 'End', color: 'bg-yellow-500' }, { label: 'Draw', color: 'bg-slate-300' }].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
            <span className="text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
        ))}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const events = eventsOnDay(day);
          const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
          return (
            <div key={day} className={`min-h-[64px] rounded-lg p-1.5 border text-xs transition-colors ${
              isToday ? 'border-slate-900 bg-slate-900' : 'border-primary/10 hover:border-primary/30 bg-card'
            }`}>
              <p className={`font-medium mb-1 ${isToday ? 'text-white' : 'text-foreground'}`}>{day}</p>
              <div className="space-y-0.5">
                {events.slice(0, 2).map((e, i) => (
                  <div key={i} className={`px-1 py-0.5 rounded text-xs truncate ${eventColor(e.type)}`} title={`${e.label} (${e.type})`}>
                    {e.type === 'start' ? 'player-play' : e.type === 'end' ? 'player-stop' : '◎'} {e.label.slice(0, 8)}
                  </div>
                ))}
                {events.length > 2 && <p className="text-muted-foreground text-xs">+{events.length - 2}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming events list */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">This Month's Events</p>
        {draws.flatMap(d => [
          { date: d.startDate, label: `${d.name} — Opens`, type: 'start' as const, status: d.status },
          { date: d.endDate,   label: `${d.name} — Closes`, type: 'end' as const, status: d.status },
          { date: d.drawDate,  label: `${d.name} — Draw Day`, type: 'draw' as const, status: d.status },
        ]).filter(e => e.date.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`))
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((e, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{e.date.slice(5)}</span>
              <div className={`w-2 h-2 rounded-full shrink-0 ${e.type === 'start' ? 'bg-green-500' : e.type === 'end' ? 'bg-yellow-500' : 'bg-slate-300'}`} />
              <span className="text-foreground">{e.label}</span>
              <StatusBadge status={e.status} />
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DrawsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [draws, setDraws]               = useState<Draw[]>([]);
  const [templates]                     = useState(MOCK_TEMPLATES);
  const [filterStatus, setFilterStatus] = useState<'all' | DrawStatus>('all');
  const [searchTerm, setSearchTerm]     = useState('');
  const [modal, setModal]               = useState<ModalView>(null);
  const [activeDraw, setActiveDraw]     = useState<Draw | null>(null);
  const [formConfig, setFormConfig]     = useState<DrawConfig>(emptyConfig());
  const [activeView, setActiveView]     = useState<'grid' | 'calendar'>('grid');
  const [saveSuccess, setSaveSuccess]   = useState(false);
  const [apiError, setApiError]         = useState('');
  const [page, setPage]                 = useState(1);
  const PAGE_SIZE = 10;

  const iconMap: Record<string, React.ComponentType<any>> = {
    cash: IconCash, product: IconPackage, voucher: IconTicket, experience: IconStar, license: IconKey,
    'player-play': IconPlayerPlay, 'player-stop': IconPlayerStop, target: IconTarget,
  };

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    if (!user || (user.role !== 'organizer' && user.role !== 'admin')) router.push('/auth');
  }, [user, isLoading, router]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterStatus]);

  // Fetch draws from API
  useEffect(() => {
    if (!user) return;
    const fetchDraws = async () => {
      try {
        const res = await api<{ success: boolean; data: any[] }>(apiUrls.draws.list);
        const mapped: Draw[] = (res.data || []).map((d: any) => ({
          id: d.id,
          name: d.title,
          description: d.description || '',
          rules: d.eligibility_notes || '',
          terms: '',
          startDate: d.registration_start?.split('T')[0] || '',
          endDate: d.registration_end?.split('T')[0] || '',
          drawDate: d.draw_date?.split('T')[0] || '',
          status: mapDrawStatus(d.status),
          initialStatus: d.status === 'open' ? 'open' as const : 'draft' as const,
          participants: parseInt(d.entry_count) || 0,
          winnersCount: d.winners_count || 1,
          entryType: d.tokens_per_entry > 0 ? 'token' : 'free' as EntryType,
          tokenPrice: 0,
          entryLimitPerParticipant: d.max_entries_per_user || 1,
          maxParticipants: d.max_participants || 1000,
          prizes: [],
          algorithm: 'crypto' as Algorithm,
          allowTies: false,
          eligibility: { minAge: '18+' as AgeGroup, requiresVerifiedId: true, requiresVerifiedEmail: true, allowedRegions: 'Worldwide', otherRequirements: '' },
          testMode: false,
          isTemplate: false,
          templateName: '',
          createdAt: d.created_at?.split('T')[0] || '',
          updatedAt: d.updated_at?.split('T')[0] || '',
          history: [],
        }));
        setDraws(mapped);
      } catch (err: any) {
        setApiError(err.message);
      }
    };
    fetchDraws();
  }, [user]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredDraws = useMemo(() => draws.filter(d => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    const q = searchTerm.toLowerCase();
    return !q || d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q);
  }), [draws, filterStatus, searchTerm]);

  const paginatedDraws = useMemo(() => filteredDraws.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredDraws, page]);

  const stats = useMemo(() => ({
    total:     draws.length,
    active:    draws.filter(d => d.status === 'active').length,
    draft:     draws.filter(d => d.status === 'draft').length,
    closed:    draws.filter(d => d.status === 'closed').length,
    completed: draws.filter(d => d.status === 'completed').length,
    totalPool: draws.reduce((s, d) => s + d.prizes.reduce((ps, p) => ps + p.value * p.quantity, 0), 0),
  }), [draws]);

  function mapDrawStatus(s: string): DrawStatus {
    if (s === 'open') return 'active';
    if (s === 'draft') return 'draft';
    if (s === 'closed') return 'closed';
    if (s === 'completed') return 'completed';
    if (s === 'cancelled') return 'closed';
    return 'draft';
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSaveDraw = useCallback(async () => {
    if (!formConfig.name.trim()) return;
    setApiError('');
    try {
      if (activeDraw) {
        const res = await api<{ success: boolean; data: any }>(
          apiUrls.draws.update(activeDraw.id),
          {
            method: 'PATCH',
            body: JSON.stringify({
              title: formConfig.name,
              description: formConfig.description,
              max_participants: formConfig.maxParticipants,
              max_entries_per_user: formConfig.entryLimitPerParticipant,
              winners_count: formConfig.winnersCount,
              token_price: formConfig.tokenPrice,
              status: formConfig.initialStatus,
              eligibility_notes: formConfig.rules,
            }),
          }
        );
        setDraws(prev => prev.map(d => d.id === activeDraw.id ? { ...d, ...formConfig, updatedAt: new Date().toISOString().split('T')[0] } : d));
      } else {
        const body: Record<string, any> = {
          title: formConfig.name,
          description: formConfig.description,
          registration_start: new Date(formConfig.startDate).toISOString(),
          registration_end: new Date(formConfig.endDate).toISOString(),
          draw_date: new Date(formConfig.drawDate).toISOString(),
          winners_count: formConfig.winnersCount,
          max_participants: formConfig.maxParticipants,
          max_entries_per_user: formConfig.entryLimitPerParticipant,
          tokens_per_entry: formConfig.entryType === 'free' ? 1 : 1,
          token_price: formConfig.tokenPrice,
          is_public: true,
          status: formConfig.initialStatus,
          eligibility_notes: formConfig.rules,
          prizes: formConfig.prizes.map(p => ({
            rank: p.rank,
            title: p.label,
            description: p.description,
            prize_type: p.category === 'experience' ? 'other' : p.category === 'license' ? 'service' : p.category,
            value: p.value,
            quantity: p.quantity,
          })),
        };
        const res = await api<{ success: boolean; data: any }>(
          apiUrls.draws.create,
          { method: 'POST', body: JSON.stringify(body) }
        );
        const newDraw: Draw = {
          ...formConfig,
          id: res.data.id,
          status: formConfig.initialStatus === 'open' ? 'active' : 'draft',
          participants: formConfig.testMode ? 8 : 0,
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
          history: [],
        };
        setDraws(prev => [newDraw, ...prev]);
      }
      setSaveSuccess(true);
      setTimeout(() => { setSaveSuccess(false); setModal(null); setActiveDraw(null); }, 1200);
    } catch (err: any) {
      setApiError(err.message);
    }
  }, [formConfig, activeDraw]);

  const handleDuplicate = useCallback((source: Draw | DrawConfig & { id: string; templateName: string }, isTemplate = false) => {
    const base = isTemplate ? { ...emptyConfig(), ...source } : { ...(source as Draw) };
    setFormConfig({
      ...base,
      name: isTemplate ? '' : `${(source as Draw).name} (Copy)`,
      isTemplate: false,
      templateName: '',
    });
    setActiveDraw(null);
    setModal('create');
  }, []);

  const handleAdvanceStatus = useCallback(async (draw: Draw) => {
    const cfg = statusConfig[draw.status];
    if (!cfg.next) return;
    setApiError('');
    try {
      const nextStatus = cfg.next === 'active' ? 'open' : cfg.next;
      if (nextStatus === 'completed') {
        await api<{ success: boolean }>(
          apiUrls.draws.execute(draw.id),
          { method: 'POST' }
        );
      } else {
        await api<{ success: boolean }>(
          apiUrls.draws.advanceStatus(draw.id),
          { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) }
        );
      }
      setDraws(prev => prev.map(d => d.id === draw.id
        ? { ...d, status: cfg.next as DrawStatus, updatedAt: new Date().toISOString().split('T')[0] }
        : d));
    } catch (err: any) {
      setApiError(err.message);
    }
  }, []);

  const handleExportReport = useCallback((draw: Draw, fmt: 'excel' | 'pdf') => {
    const reportRows = [
      { Field: 'ID', Value: draw.id },
      { Field: 'Name', Value: draw.name },
      { Field: 'Status', Value: draw.status },
      { Field: 'Description', Value: draw.description },
      { Field: 'Start Date', Value: draw.startDate },
      { Field: 'End Date', Value: draw.endDate },
      { Field: 'Draw Date', Value: draw.drawDate },
      { Field: 'Participants', Value: draw.participants },
      { Field: 'Max Participants', Value: draw.maxParticipants },
      { Field: 'Winners', Value: draw.winnersCount },
      { Field: 'Entry Type', Value: draw.entryType },
      { Field: 'Token Price', Value: `$${draw.tokenPrice}` },
      { Field: 'Entry Limit', Value: draw.entryLimitPerParticipant },
      { Field: 'Algorithm', Value: draw.algorithm },
      { Field: 'Min Age', Value: draw.eligibility.minAge },
      { Field: 'Regions', Value: Array.isArray(draw.eligibility.allowedRegions) ? draw.eligibility.allowedRegions.join(', ') : String(draw.eligibility.allowedRegions ?? '') },
      { Field: 'Requires Verified ID', Value: draw.eligibility.requiresVerifiedId ? 'Yes' : 'No' },
      ...draw.prizes.map(p => ({ Field: `Prize #${p.rank}`, Value: `${p.label}: ${p.description} ($\${p.value})` })),
      { Field: 'Total Prize Pool', Value: `$${draw.prizes.reduce((s, p) => s + p.value * p.quantity, 0)}` },
    ];
    const columns: ExportColumn[] = [
      { header: 'Field', key: 'Field' },
      { header: 'Value', key: 'Value' },
    ];
    const base = `draw-report-${draw.id}`;
    if (fmt === 'excel') {
      exportExcel(reportRows, columns, base, 'Draw Report');
    } else {
      exportPDF({ filename: base, title: `Draw Report: ${draw.name}`, subtitle: `Status: ${draw.status}`, columns, data: reportRows });
    }
  }, []);

  const handleExportAllReports = useCallback((fmt: 'excel' | 'pdf') => {
    const columns: ExportColumn[] = [
      { header: 'ID', key: 'id' },
      { header: 'Name', key: 'name' },
      { header: 'Status', key: 'status' },
      { header: 'Start', key: 'startDate' },
      { header: 'End', key: 'endDate' },
      { header: 'Draw Date', key: 'drawDate' },
      { header: 'Participants', key: 'participants' },
      { header: 'Winners', key: 'winnersCount' },
      { header: 'Entry Type', key: 'entryType' },
      { header: 'Prize Pool', key: 'prizePool' },
      { header: 'Algorithm', key: 'algorithm' },
    ];
    const data = draws.map(d => ({
      ...d,
      prizePool: `$${d.prizes.reduce((s, p) => s + p.value * p.quantity, 0)}`,
    }));
    const base = `all-draws-report-${Date.now()}`;
    if (fmt === 'excel') {
      exportExcel(data, columns, base, 'Draws');
    } else {
      exportPDF({ filename: base, title: 'All Draws Report', subtitle: `${draws.length} draws`, columns, data });
    }
  }, [draws]);

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (isLoading || !user) return null;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Draw Management</h1>
              <p className="text-muted-foreground mt-1">Create, configure, and manage the full lifecycle of your draws.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleExportAllReports('pdf')} variant="outline" className="border-primary/20 text-xs">
                ↓ Export All (PDF)
              </Button>
              <Button onClick={() => handleExportAllReports('excel')} variant="outline" className="border-primary/20 text-xs">
                ↓ Export All (Excel)
              </Button>
              <Button onClick={() => { setFormConfig(emptyConfig()); setActiveDraw(null); setModal('create'); }}
                className="bg-[#3BB82E] text-white hover:bg-[#288C1D] font-semibold">
                + New Draw
              </Button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
            className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'Total',     value: stats.total,     color: 'text-foreground',      bg: 'bg-card border-primary/20' },
              { label: 'Active',    value: stats.active,    color: 'text-[#3BB82E]',       bg: 'bg-[#3BB82E]/5 border-[#3BB82E]/20' },
              { label: 'Draft',     value: stats.draft,     color: 'text-slate-500',       bg: 'bg-slate-50 border-slate-200' },
              { label: 'Closed',    value: stats.closed,    color: 'text-amber-600',       bg: 'bg-amber-50 border-amber-200' },
              { label: 'Completed', value: stats.completed, color: 'text-[#3BB82E]',       bg: 'bg-[#3BB82E]/5 border-[#3BB82E]/20' },
              { label: 'Prize Pool', value: `$${stats.totalPool.toLocaleString()}`, color: 'text-[#3BB82E]', bg: 'bg-[#3BB82E]/5 border-[#3BB82E]/20' },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }} className={`border rounded-lg p-3 ${s.bg}`}>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Templates bar */}
          {templates.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}
              className="bg-card border border-primary/20 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Templates</p>
              <div className="flex gap-2 flex-wrap">
                {templates.map(t => (
                  <button key={t.id} onClick={() => handleDuplicate(t, true)}
                    className="flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted border border-primary/20 rounded-lg text-xs text-foreground transition-all hover:border-slate-300">
                    <span className="flex items-center"><IconClipboard size={20} stroke={1.5} /></span>
                    <span>{t.templateName}</span>
                    <span className="text-primary">→</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* View toggle + Search + Filter */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="flex gap-3 items-center">
            <Input placeholder="Search draws…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 border-primary/20 bg-background text-foreground" />
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {(['all', 'draft', 'active', 'closed', 'completed'] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${filterStatus === s ? 'bg-[#3BB82E] text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <button onClick={() => setActiveView('grid')}
                className={`px-3 py-1.5 rounded text-xs transition-all ${activeView === 'grid' ? 'bg-[#3BB82E] text-white' : 'text-muted-foreground'}`}>
                ▦ Grid
              </button>
              <button onClick={() => setModal('calendar')}
                className="px-3 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground transition-all">
                Calendar
              </button>
            </div>
          </motion.div>

          {/* Draw Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence>
              {paginatedDraws.map((draw, idx) => {
                const totalPool = draw.prizes.reduce((s, p) => s + p.value * p.quantity, 0);
                const cfg = statusConfig[draw.status];
                const participantPct = draw.maxParticipants > 0 ? Math.min(100, (draw.participants / draw.maxParticipants) * 100) : 0;

                return (
                  <motion.div key={draw.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }} transition={{ delay: idx * 0.05 }}
                    className="bg-card border border-primary/20 rounded-xl p-6 space-y-4 border-l-4 hover:shadow-lg hover:shadow-[#3BB82E]/5 hover:border-[#3BB82E]/40 transition-all"
                    style={{ borderLeftColor: draw.status === 'active' ? '#3BB82E' : draw.status === 'completed' ? '#3BB82E' : draw.status === 'closed' ? '#f59e0b' : '#94a3b8' }}>

                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <StatusBadge status={draw.status} />
                          {draw.testMode && <span className="text-xs bg-yellow-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">Test</span>}
                          {draw.entryType === 'paid' && <span className="text-xs bg-[#3BB82E]/10 text-[#3BB82E] border border-[#3BB82E]/30 px-2 py-0.5 rounded-full">Paid</span>}
                        </div>
                        <h3 className="text-lg font-bold text-foreground truncate">{draw.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{draw.description}</p>
                      </div>
                      {totalPool > 0 && (
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">Prize Pool</p>
                          <p className="text-lg font-bold text-[#3BB82E]">${totalPool.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[
                        { label: 'Opens', date: draw.startDate, icon: 'player-play' },
                        { label: 'Closes', date: draw.endDate, icon: 'player-stop' },
                        { label: 'Draw', date: draw.drawDate, icon: 'target' },
                      ].map(d => (
                        <div key={d.label} className="bg-muted/30 rounded-lg p-2 text-center">
                           <p className="text-muted-foreground flex items-center gap-1">{(() => { const Ic = iconMap[d.icon]; return Ic ? <Ic size={14} stroke={1.5} /> : null; })()} {d.label}</p>
                          <p className="text-foreground font-mono font-medium">{d.date.slice(5)}</p>
                        </div>
                      ))}
                    </div>

                    {/* Prize tiers preview */}
                    <div className="bg-[#f7faf7] rounded-lg p-3 border border-[#3BB82E]/10 space-y-1">
                      {draw.prizes.slice(0, 2).map(tier => (
                        <div key={tier.rank} className="flex items-center gap-2 text-xs">
                          <span className="text-[#3BB82E]">{categoryIcon[tier.category]}</span>
                          <span className="text-[#3BB82E] font-medium w-14 shrink-0">{tier.label}</span>
                          <span className="text-foreground flex-1 truncate">{tier.description}</span>
                          {tier.value > 0 && <span className="text-[#3BB82E] font-semibold">${tier.value.toLocaleString()}</span>}
                        </div>
                      ))}
                      {draw.prizes.length > 2 && <p className="text-xs text-muted-foreground">+{draw.prizes.length - 2} more tiers</p>}
                    </div>

                    {/* Participants progress */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium">Participants</span>
                        <span className="font-mono">{draw.participants.toLocaleString()} / {draw.maxParticipants.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${participantPct === 100 ? 'bg-[#3BB82E]' : 'bg-[#3BB82E]/70'}`} style={{ width: `${participantPct}%` }} />
                      </div>
                    </div>

                    {/* Entry info */}
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground border-t border-primary/10 pt-3">
                      <AlgorithmBadge algo={draw.algorithm} />
                      <span>·</span>
                      <span>Max {draw.entryLimitPerParticipant} entr{draw.entryLimitPerParticipant > 1 ? 'ies' : 'y'}/person</span>
                      {draw.entryType === 'paid' && <><span>·</span><span className="text-[#3BB82E] font-semibold">${draw.tokenPrice}/token</span></>}
                      <span>·</span>
                      <span>{draw.eligibility.minAge}</span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      {cfg.next && (
                        <Button onClick={() => handleAdvanceStatus(draw)} size="sm"
                          className="bg-[#3BB82E] text-white hover:bg-[#288C1D] text-xs font-semibold">
                          {cfg.nextLabel} →
                        </Button>
                      )}
                      <Button onClick={() => { setFormConfig({ ...draw }); setActiveDraw(draw); setModal('edit'); }}
                        variant="outline" size="sm" className="border-primary/20 text-xs">
                        Edit
                      </Button>
                      <Button onClick={() => handleDuplicate(draw)} variant="outline" size="sm" className="border-primary/20 text-xs">
                        Duplicate
                      </Button>
                      {draw.history.length > 0 && (
                        <Button onClick={() => { setActiveDraw(draw); setModal('history'); }} variant="outline" size="sm" className="border-primary/20 text-xs">
                          History
                        </Button>
                      )}
                <Button onClick={() => handleExportReport(draw, 'excel')} variant="outline" size="sm" className="border-primary/20 text-xs">
                  ↓ Export
                </Button>
                      <Button onClick={() => router.push(`/dashboard/organizer/draws/${draw.id}`)} variant="outline" size="sm" className="border-[#3BB82E]/40 text-[#3BB82E] hover:bg-[#3BB82E]/10 text-xs font-medium">
                        Details →
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredDraws.length > 0 && (
            <Pagination page={page} totalItems={filteredDraws.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          )}

          {filteredDraws.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-3">No draws match your filter.</p>
              <Button onClick={() => { setFilterStatus('all'); setSearchTerm(''); }} variant="outline" className="border-primary/20">Reset</Button>
            </div>
          )}
        </div>
      </main>

      {/* ══════ MODALS ══════ */}
      <AnimatePresence>
        {modal && (
          <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setModal(null); setActiveDraw(null); }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }} onClick={e => e.stopPropagation()}
              className="bg-card border border-primary/20 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

              {/* Create / Edit Modal */}
              {(modal === 'create' || modal === 'edit') && (
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">
                        {modal === 'edit' ? `Edit: ${activeDraw?.name}` : 'Create New Draw'}
                      </h2>
                      <p className="text-sm text-muted-foreground">Configure all draw parameters</p>
                    </div>
                    <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
                  </div>

                  <DrawForm config={formConfig} onChange={setFormConfig} />

                  {apiError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-600 text-center">
                      {apiError}
                    </div>
                  )}
                  {saveSuccess && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-400">
                      <IconCircleCheck size={16} stroke={1.5} /> Draw {modal === 'edit' ? 'updated' : 'created'} successfully!
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={() => setModal(null)} variant="outline" className="flex-1 border-primary/20">Cancel</Button>
                    <Button onClick={handleSaveDraw} disabled={!formConfig.name.trim() || saveSuccess}
                      className="flex-1 bg-[#3BB82E] text-white hover:bg-[#288C1D] font-semibold">
                      {saveSuccess ? (<><IconCheck size={16} stroke={1.5} /> Saved!</>) : modal === 'edit' ? 'Save Changes' : 'Create Draw'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Calendar Modal */}
              {modal === 'calendar' && (
                <div onClick={e => e.stopPropagation()}>
                  <CalendarView draws={draws} />
                  <div className="p-4 border-t border-primary/10">
                    <Button onClick={() => setModal(null)} variant="outline" className="w-full border-primary/20">Close</Button>
                  </div>
                </div>
              )}

              {/* History Modal */}
              {modal === 'history' && activeDraw && (
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">Draw History</h2>
                      <p className="text-sm text-muted-foreground">{activeDraw.name}</p>
                    </div>
                    <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
                  </div>

                  {activeDraw.result && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">Latest Result</p>
                        <span className="text-xs text-muted-foreground font-mono">{activeDraw.result.executedAt.replace('T', ' ').split('.')[0]}</span>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground">Seed: <span className="text-slate-700">{activeDraw.result.seed}</span></p>
                      <div className="space-y-1.5">
                        {activeDraw.result.winners.map(w => (
                          <div key={w.rank} className="flex items-center gap-2 text-sm">
                            <span className="text-slate-700 font-mono text-xs w-6">#{w.rank}</span>
                            <span className="text-foreground">{w.name}</span>
                            <span className="text-muted-foreground font-mono text-xs ml-auto">{w.tokenId}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">All Runs ({activeDraw.history.length})</p>
                    {activeDraw.history.map((run, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted/30 border border-primary/10 rounded-lg p-3 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">{run.executedAt.replace('T', ' ').split('.')[0]}</span>
                        <span className="text-foreground">{run.winnersCount} winner{run.winnersCount > 1 ? 's' : ''}</span>
                        <AlgorithmBadge algo={activeDraw.algorithm} />
                      </div>
                    ))}
                    {activeDraw.history.length === 0 && <p className="text-sm text-muted-foreground italic">No execution history yet.</p>}
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => handleExportReport(activeDraw, 'pdf')} variant="outline" className="flex-1 border-primary/20 text-xs">↓ Export Report (PDF)</Button>
                    <Button onClick={() => setModal(null)} className="flex-1 bg-slate-800 text-white hover:bg-slate-700 text-xs">Close</Button>
                  </div>
                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}