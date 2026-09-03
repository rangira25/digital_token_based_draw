'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { api, apiUrls } from '@/lib/api';
import { exportExcel, exportPDF, type ExportColumn } from '@/lib/export';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { IconTrendingUp, IconAlertTriangle, IconEye, IconX, IconCheck } from '@tabler/icons-react';

// ─── Helper: format date labels ──────────────────────────────────────────────
function fmtDay(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Derive chart data from real API entry_trend ────────────────────────────
function deriveChartData(
  entryTrend: { day: string; entries: string; unique_participants: string }[],
  timeRange: string,
) {
  if (!entryTrend || entryTrend.length === 0) return { participation: [], entryVolume: [] };
  const now = Date.now();
  const cutoffs: Record<string, number> = {
    '24h': 7 * 86400000,
    '7d': 7 * 86400000,
    '30d': 30 * 86400000,
    '90d': 30 * 86400000,
  };
  const ms = cutoffs[timeRange] ?? 30 * 86400000;
  const filtered = entryTrend.filter(r => now - new Date(r.day).getTime() <= ms);

  const participation = filtered.map(r => ({
    label: fmtDay(r.day),
    value: Number(r.entries),
  }));
  const entryVolume = filtered.map(r => ({
    label: fmtDay(r.day),
    entries: Number(r.entries),
    unique: Number(r.unique_participants),
  }));
  return { participation, entryVolume };
}

const REPORT_METRICS = [
  { id: 'participation', label: 'Participation Trends' },
  { id: 'entry_volume', label: 'Entry Volume Analysis' },
  { id: 'demographics', label: 'Winner Demographics' },
  { id: 'claim_rates', label: 'Prize Claim Rates' },
  { id: 'draw_popularity', label: 'Draw Popularity' },
  { id: 'organizer_perf', label: 'Organizer Performance' },
  { id: 'revenue', label: 'Revenue Metrics' },
  { id: 'token_usage', label: 'Token Usage' },
];

export default function AnalyticsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d');
  const [analyticsDataReal, setAnalyticsDataReal] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Fetch real analytics from API
  useEffect(() => {
    if (!user) return;
    const fetchAnalytics = async () => {
      try {
        const res = await api<{ success: boolean; data: any }>(apiUrls.analytics.get);
        setAnalyticsDataReal(res.data);
      } catch {} finally {
        setAnalyticsLoading(false);
      }
    };
    fetchAnalytics();
  }, [user]);

  // Report Builder
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['participation', 'claim_rates', 'demographics']);
  const [reportFormat, setReportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [reportDateRange, setReportDateRange] = useState('7d');
  const [showPreview, setShowPreview] = useState(false);

  // Scheduled Reports
  const [schedules, setSchedules] = useState([
    { id: 1, name: 'Weekly Summary', frequency: 'Weekly', day: 'Monday', time: '08:00', format: 'PDF', recipients: 3, active: true },
    { id: 2, name: 'Monthly Deep Dive', frequency: 'Monthly', day: '1st', time: '09:00', format: 'Excel', recipients: 5, active: true },
    { id: 3, name: 'Daily Snapshot', frequency: 'Daily', day: '—', time: '07:00', format: 'PDF', recipients: 1, active: false },
  ]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ name: '', frequency: 'Weekly', time: '08:00', format: 'PDF' });

  // Distribution Manager
  const [recipients, setRecipients] = useState([
    { id: 1, name: 'Alice Johnson', email: 'alice@org.com', role: 'Admin', reports: ['Weekly Summary', 'Monthly Deep Dive'] },
    { id: 2, name: 'Bob Chen', email: 'bob@org.com', role: 'Manager', reports: ['Monthly Deep Dive'] },
    { id: 3, name: 'Carol Smith', email: 'carol@org.com', role: 'Analyst', reports: ['Weekly Summary', 'Monthly Deep Dive', 'Daily Snapshot'] },
    { id: 4, name: 'David Park', email: 'david@org.com', role: 'Executive', reports: ['Monthly Deep Dive'] },
  ]);
  const [newRecipient, setNewRecipient] = useState({ name: '', email: '', role: 'Analyst' });
  const [showAddRecipient, setShowAddRecipient] = useState(false);

  // Executive Summary
  const [summaryGenerating, setSummaryGenerating] = useState(false);
  const [summaryGenerated, setSummaryGenerated] = useState(false);

  // Wait for auth to hydrate before deciding to redirect.
  // The synchronous guard fires on every refresh before the context
  // has read from storage, so we defer until loading is false.
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'organizer')) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map(i => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-slate-300 rounded-full"
                animate={{ y: [-4, 4, -4] }}
                transition={{ delay: i * 0.15, repeat: Infinity, duration: 0.8 }}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground font-mono">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'organizer') return null;

  // Merge real analytics data over mock defaults
  const mergedKpis = analyticsDataReal ? [
    { label: 'Total Draws', value: String(analyticsDataReal.draws?.total_draws || 0), change: '', trend: 'up' as const },
    { label: 'Active Draws', value: String(analyticsDataReal.draws?.active_draws || 0), change: '', trend: 'up' as const },
    { label: 'Total Entries', value: String(analyticsDataReal.entries?.total_entries || 0), change: '', trend: 'up' as const },
    { label: 'Unique Participants', value: String(analyticsDataReal.entries?.unique_participants || 0), change: '', trend: 'up' as const },
    { label: 'Active Tokens', value: String(analyticsDataReal.tokens?.active_tokens || 0), change: '', trend: 'up' as const },
    { label: 'Winners', value: String(analyticsDataReal.winners?.total_winners || 0), change: '', trend: 'up' as const },
  ] : [];

  // Derive chart data from real API entry_trend
  const { participation, entryVolume } = deriveChartData(analyticsDataReal?.entry_trend || [], timeRange);
  const currentData = {
    kpis: mergedKpis.length > 0 ? mergedKpis : [
      { label: 'Total Draws', value: '—', change: '', trend: 'up' as const },
      { label: 'Active Draws', value: '—', change: '', trend: 'up' as const },
      { label: 'Total Entries', value: '—', change: '', trend: 'up' as const },
      { label: 'Unique Participants', value: '—', change: '', trend: 'up' as const },
      { label: 'Active Tokens', value: '—', change: '', trend: 'up' as const },
      { label: 'Winners', value: '—', change: '', trend: 'up' as const },
    ],
    participation,
    entryVolume,
  };
  const maxParticipation = Math.max(...currentData.participation.map(d => d.value), 1);
  const maxEntries = Math.max(...currentData.entryVolume.map(d => d.entries), 1);
  const peakDay = currentData.entryVolume.length > 0
    ? currentData.entryVolume.reduce((max, d) => d.entries > max.entries ? d : max)
    : { label: '—', entries: 0, unique: 0 };
  const avgMultiplier = currentData.entryVolume.length > 0
    ? (
        currentData.entryVolume.reduce((a, b) => a + b.entries, 0) /
        Math.max(currentData.entryVolume.reduce((a, b) => a + b.unique, 0), 1)
      ).toFixed(1)
    : '0';

  // Real top draws from API
  const topDraws: { title: string; entry_count: number; max_participants: number | null; status: string }[] =
    analyticsDataReal?.top_draws || [];

  const handleReportExport = (fmt: 'pdf' | 'excel') => {
    const base = `analytics-report-${Date.now()}`;
    if (fmt === 'excel') {
      exportExcel(currentData.entryVolume, [
        { header: 'Time', key: 'label' },
        { header: 'Entries', key: 'entries' },
        { header: 'Unique Participants', key: 'unique' },
      ], base, 'Entry Volume');
    } else {
      exportPDF({
        filename: base,
        title: 'Analytics Report',
        subtitle: `Time range: ${timeRange} • Peak ${peakDay.label}: ${peakDay.entries} entries`,
        columns: [
          { header: 'Time', key: 'label' },
          { header: 'Entries', key: 'entries' },
          { header: 'Unique Participants', key: 'unique' },
        ],
        data: currentData.entryVolume,
      });
    }
  };

  const toggleMetric = (id: string) => {
    setSelectedMetrics(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const generateSummary = () => {
    setSummaryGenerating(true);
    setSummaryGenerated(false);
    setTimeout(() => {
      setSummaryGenerating(false);
      setSummaryGenerated(true);
    }, 2000);
  };

  const addSchedule = () => {
    if (!newSchedule.name) return;
    setSchedules(prev => [...prev, {
      id: Date.now(),
      name: newSchedule.name,
      frequency: newSchedule.frequency,
      day: newSchedule.frequency === 'Daily' ? '—' : 'Monday',
      time: newSchedule.time,
      format: newSchedule.format,
      recipients: 0,
      active: true,
    }]);
    setShowScheduleForm(false);
    setNewSchedule({ name: '', frequency: 'Weekly', time: '08:00', format: 'PDF' });
  };

  const addRecipient = () => {
    if (!newRecipient.name || !newRecipient.email) return;
    setRecipients(prev => [...prev, { id: Date.now(), ...newRecipient, reports: [] }]);
    setShowAddRecipient(false);
    setNewRecipient({ name: '', email: '', role: 'Analyst' });
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">Analytics & Reports</h1>
            <p className="text-muted-foreground">Comprehensive draw performance metrics</p>
          </div>
          <div className="flex gap-2">
            {(['24h', '7d', '30d', '90d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded font-mono text-sm transition-all ${
                  timeRange === range
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-primary/20 text-muted-foreground hover:text-foreground'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {currentData.kpis.map((kpi, idx) => (
            <motion.div
              key={`${timeRange}-kpi-${idx}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-card border border-primary/20 rounded-lg p-6 space-y-2"
            >
              <p className="text-sm text-muted-foreground font-mono uppercase">{kpi.label}</p>
              <div className="flex items-end justify-between gap-4">
                <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
                <span className={`text-sm font-mono ${kpi.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                  {kpi.change}
                </span>
              </div>
              <div className="h-1 bg-muted rounded overflow-hidden">
                <div className={`h-full ${kpi.trend === 'up' ? 'bg-green-500/50' : 'bg-red-500/50'} rounded`} style={{ width: '65%' }} />
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Charts Row 1: Participation Trend + Top Draws ──────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid lg:grid-cols-2 gap-6"
        >
          {/* Participation Trend */}
          <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-4">
            <h3 className="text-lg font-bold text-foreground">Participation Trend</h3>
            <div className="space-y-4">
              {currentData.participation.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <span className="w-16 text-xs text-muted-foreground text-right font-mono">{item.label}</span>
                  <div className="flex-1 h-8 bg-slate-100 rounded relative overflow-hidden">
                    <motion.div
                      key={`${timeRange}-bar-${idx}`}
                      className="h-full bg-slate-300 rounded"
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.value / maxParticipation) * 100}%` }}
                      transition={{ delay: idx * 0.06, duration: 0.5 }}
                    />
                  </div>
                  <span className="w-16 text-sm font-mono text-foreground text-right">
                    {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Draws */}
          <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-4">
            <h3 className="text-lg font-bold text-foreground">Top Draws by Participation</h3>
            <div className="space-y-4">
              {topDraws.length === 0 && (
                <p className="text-sm text-muted-foreground">No draws with entries yet.</p>
              )}
              {topDraws.map((draw, idx) => {
                const fill = draw.max_participants
                  ? Math.min(100, Math.round((draw.entry_count / draw.max_participants) * 100))
                  : 50;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-medium">{draw.title}</span>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                          draw.status === 'completed' ? 'bg-green-500/20 text-green-600' : 'bg-blue-500/20 text-blue-600'
                        }`}>{draw.status}</span>
                        <span className="text-slate-700 font-mono">{draw.entry_count.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded overflow-hidden">
                      <motion.div
                        className="h-full bg-primary/60 rounded"
                        initial={{ width: 0 }}
                        animate={{ width: `${fill}%` }}
                        transition={{ delay: idx * 0.08, duration: 0.5 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* ── Entry Volume Analysis (NEW) ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Entry Volume Analysis</h3>
                <p className="text-sm text-muted-foreground mt-1">Total entries vs. unique participants over time</p>
              </div>
              <div className="flex gap-4 text-xs font-mono">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-slate-300 inline-block" />
                  Total Entries
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-primary/60 inline-block" />
                  Unique Participants
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {currentData.entryVolume.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <span className="w-16 text-xs text-muted-foreground text-right font-mono">{item.label}</span>
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-muted rounded overflow-hidden">
                      <motion.div
                        key={`${timeRange}-ev-entries-${idx}`}
                        className="h-full bg-slate-400 rounded"
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.entries / maxEntries) * 100}%` }}
                        transition={{ delay: idx * 0.05, duration: 0.5 }}
                      />
                    </div>
                    <div className="h-3 bg-muted rounded overflow-hidden">
                      <motion.div
                        key={`${timeRange}-ev-unique-${idx}`}
                        className="h-full bg-primary/50 rounded"
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.unique / maxEntries) * 100}%` }}
                        transition={{ delay: idx * 0.05 + 0.1, duration: 0.5 }}
                      />
                    </div>
                  </div>
                  <div className="w-28 text-right space-y-1">
                    <p className="text-xs font-mono text-foreground">{item.entries.toLocaleString()}</p>
                    <p className="text-xs font-mono text-muted-foreground">{item.unique.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary stats */}
            <div className="flex gap-8 pt-2 border-t border-primary/10">
              {[
                { label: 'Avg Entries per Participant', value: `${avgMultiplier}x` },
                { label: 'Peak Entry Period', value: peakDay.label },
                { label: 'Total Entries', value: currentData.entryVolume.reduce((a, b) => a + b.entries, 0).toLocaleString() },
              ].map((stat, idx) => (
                <div key={idx} className="space-y-1">
                  <p className="text-xs text-muted-foreground font-mono uppercase">{stat.label}</p>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Charts Row 2: Demographics + Claim Status ──────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid lg:grid-cols-2 gap-6"
        >
          {/* Winner Demographics (derived from real data) */}
          <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-4">
            <h3 className="text-lg font-bold text-foreground">Winner Stats</h3>
            <div className="space-y-3">
              {[
                { label: 'Total Winners', value: analyticsDataReal?.winners?.total_winners || 0 },
                { label: 'Prizes Claimed', value: analyticsDataReal?.winners?.claimed_prizes || 0 },
                { label: 'Pending Claims', value: analyticsDataReal?.winners?.pending_claims || 0 },
                { label: 'Active Draws', value: analyticsDataReal?.draws?.active_draws || 0 },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded">
                  <span className="text-sm text-foreground">{item.label}</span>
                  <span className="text-lg font-bold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-primary/10 grid grid-cols-2 gap-3">
              {[
                {
                  label: 'Tokens Issued',
                  value: String(analyticsDataReal?.tokens?.active_tokens || 0),
                },
                {
                  label: 'Tokens Used',
                  value: String(analyticsDataReal?.tokens?.used_tokens || 0),
                },
                {
                  label: 'Total Tokens',
                  value: String(analyticsDataReal?.tokens?.total_tokens || 0),
                },
                {
                  label: 'Completion Rate',
                  value: analyticsDataReal?.draws?.total_draws
                    ? `${Math.round(((analyticsDataReal.draws.completed_draws || 0) / analyticsDataReal.draws.total_draws) * 100)}%`
                    : '—',
                },
              ].map((item, idx) => (
                <div key={idx} className="p-3 bg-muted/50 rounded space-y-1">
                  <p className="text-xs text-muted-foreground font-mono">{item.label}</p>
                  <p className="text-lg font-bold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Prize Claim Status */}
          <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-4">
            <h3 className="text-lg font-bold text-foreground">Prize Claim Status</h3>
            {(() => {
              const w = analyticsDataReal?.winners || {};
              const claimed = Number(w.claimed_prizes || 0);
              const pending = Number(w.pending_claims || 0);
              const total = Number(w.total_winners || 0);
              const unclaimed = Math.max(0, total - claimed - pending);
              const claimRate = total > 0 ? Math.round((claimed / total) * 1000) / 10 : 0;
              return (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Claimed', value: claimed, color: 'text-green-500' },
                      { label: 'Pending', value: pending, color: 'text-yellow-500' },
                      { label: 'Unclaimed', value: unclaimed, color: 'text-red-400' },
                      { label: 'Total Winners', value: total, color: 'text-foreground' },
                    ].map((item, idx) => (
                      <div key={idx} className="p-4 bg-muted rounded space-y-2 text-center">
                        <p className="text-sm text-muted-foreground">{item.label}</p>
                        <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Overall Claim Rate</span>
                      <span className="font-mono text-foreground">{claimRate}%</span>
                    </div>
                    <div className="h-3 bg-muted rounded overflow-hidden flex">
                      <div
                        className="h-full bg-green-500/70 rounded-l transition-all duration-500"
                        style={{ width: `${total > 0 ? (claimed / total) * 100 : 0}%` }}
                      />
                      <div
                        className="h-full bg-yellow-500/70 transition-all duration-500"
                        style={{ width: `${total > 0 ? (pending / total) * 100 : 0}%` }}
                      />
                      <div
                        className="h-full bg-red-400/70 rounded-r transition-all duration-500"
                        style={{ width: `${total > 0 ? (unclaimed / total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </motion.div>

        {/* ── Organizer Performance Metrics (derived from real data) ──────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Performance Overview</h3>
                <p className="text-sm text-muted-foreground mt-1">Your platform metrics at a glance</p>
              </div>
              {analyticsDataReal?.draws?.completed_draws > 0 && (
                <span className="px-3 py-1 bg-green-500/20 text-green-600 text-xs font-mono rounded-full border border-green-500/30">
                  Active
                </span>
              )}
            </div>

            {(() => {
              const draws = analyticsDataReal?.draws || {};
              const entries = analyticsDataReal?.entries || {};
              const tokens = analyticsDataReal?.tokens || {};
              const winners = analyticsDataReal?.winners || {};
              const totalDraws = Number(draws.total_draws || 0);
              const completedDraws = Number(draws.completed_draws || 0);
              const totalEntries = Number(entries.total_entries || 0);
              const uniqueParticipants = Number(entries.unique_participants || 0);
              const completionRate = totalDraws > 0 ? Math.round((completedDraws / totalDraws) * 10) / 10 : 0;
              const avgEntriesPerDraw = totalDraws > 0 ? Math.round(totalEntries / totalDraws) : 0;
              const tokenUsageRate = Number(tokens.total_tokens || 0) > 0
                ? Math.round((Number(tokens.used_tokens || 0) / Number(tokens.total_tokens || 1)) * 10)
                : 0;
              return (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Draws', value: String(totalDraws), sub: `${draws.active_draws || 0} active`, color: 'text-foreground', bg: 'bg-muted border border-primary/20' },
                      { label: 'Avg Entries/Draw', value: String(avgEntriesPerDraw), sub: `${uniqueParticipants} unique`, color: 'text-foreground', bg: 'bg-muted border border-primary/20' },
                      { label: 'Completion Rate', value: `${completionRate}%`, sub: `${completedDraws} completed`, color: 'text-green-600', bg: 'bg-green-500/10 border border-green-500/20' },
                      { label: 'Token Usage', value: `${tokenUsageRate}%`, sub: `${tokens.used_tokens || 0}/${tokens.total_tokens || 0} used`, color: 'text-blue-600', bg: 'bg-blue-500/10 border border-blue-500/20' },
                    ].map((card, idx) => (
                      <div key={idx} className={`p-4 rounded-lg border space-y-2 ${card.bg}`}>
                        <p className="text-xs text-muted-foreground font-mono uppercase">{card.label}</p>
                        <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                        <p className="text-xs text-muted-foreground">{card.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Summary Stats */}
                  <div className="space-y-4">
                    <p className="text-xs font-mono text-muted-foreground uppercase">Quick Stats</p>
                    {[
                      { metric: 'Prizes Awarded', value: String(winners.total_winners || 0), suffix: 'prizes' },
                      { metric: 'Claimed', value: `${Number(winners.total_winners || 0) > 0 ? Math.round((Number(winners.claimed_prizes || 0) / Number(winners.total_winners || 1)) * 100) : 0}%`, suffix: 'of prizes' },
                      { metric: 'Token Pool Size', value: String(tokens.total_tokens || 0), suffix: 'tokens' },
                      { metric: 'Draws Opened', value: String(draws.active_draws || 0), suffix: 'currently' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm text-foreground">{item.metric}</span>
                        <span className="text-sm font-mono text-foreground">
                          {item.value} <span className="text-muted-foreground">{item.suffix}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </motion.div>

        {/* ── Executive Summary Generator (NEW) ──────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Executive Summary</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Auto-generated insights from your {timeRange} data
                </p>
              </div>
              <Button
                onClick={generateSummary}
                disabled={summaryGenerating}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono"
              >
                {summaryGenerating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Generating...
                  </span>
                ) : 'Generate Summary'}
              </Button>
            </div>

            <AnimatePresence mode="wait">
              {summaryGenerating && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-32 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-3"
                >
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map(i => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 bg-slate-300 rounded-full"
                        animate={{ y: [-4, 4, -4] }}
                        transition={{ delay: i * 0.15, repeat: Infinity, duration: 0.8 }}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">Analyzing {timeRange} data...</p>
                </motion.div>
              )}

              {summaryGenerated && !summaryGenerating && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Headline */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs font-mono text-slate-600 uppercase mb-2">Period Headline</p>
                    <p className="text-foreground text-sm leading-relaxed">
                      Your platform currently has{' '}
                      <strong className="text-slate-700">{analyticsDataReal?.draws?.total_draws || 0} draws</strong>{' '}
                      with{' '}
                      <strong className="text-slate-700">{analyticsDataReal?.entries?.total_entries || 0} entries</strong>{' '}
                      from{' '}
                      <strong className="text-slate-700">{analyticsDataReal?.entries?.unique_participants || 0} participants</strong>.{' '}
                      {analyticsDataReal?.winners?.total_winners
                        ? `${analyticsDataReal.winners.total_winners} prizes have been awarded.`
                        : 'No prizes awarded yet.'}
                    </p>
                  </div>

                  {/* Insight Cards */}
                  <div className="grid md:grid-cols-3 gap-4">
                    {[
                      {
                        icon: 'trendUp',
                        title: 'Draw Activity',
                        body: `${analyticsDataReal?.draws?.active_draws || 0} draws currently open with ${analyticsDataReal?.draws?.completed_draws || 0} completed.`,
                        type: 'positive',
                      },
                      {
                        icon: 'alertTriangle',
                        title: 'Prize Claims',
                        body: analyticsDataReal?.winners?.pending_claims
                          ? `${analyticsDataReal.winners.pending_claims} prizes still awaiting claim. Consider sending reminders.`
                          : 'All prizes are settled.',
                        type: analyticsDataReal?.winners?.pending_claims ? 'warning' : 'positive',
                      },
                      {
                        icon: 'eye',
                        title: 'Peak Activity',
                        body: peakDay.label !== '—'
                          ? `Highest recent activity on ${peakDay.label} with ${peakDay.entries.toLocaleString()} entries.`
                          : 'Not enough data yet to determine peak activity.',
                        type: 'insight',
                      },
                    ].map((insight, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`p-4 rounded-lg border space-y-2 ${
                          insight.type === 'positive'
                            ? 'bg-green-500/10 border-green-500/20'
                            : insight.type === 'warning'
                            ? 'bg-yellow-500/10 border-yellow-500/20'
                            : 'bg-blue-500/10 border-blue-500/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {(() => { const iconMap: Record<string, React.ComponentType<any>> = { trendUp: IconTrendingUp, alertTriangle: IconAlertTriangle, eye: IconEye }; const Ic = iconMap[insight.icon]; return Ic ? <Ic size={18} stroke={1.5} /> : null; })()}
                          <p className="text-sm font-bold text-foreground">{insight.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{insight.body}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Recommendations */}
                  <div className="p-4 bg-muted/40 rounded-lg space-y-3">
                    <p className="text-xs font-mono text-muted-foreground uppercase">Data-Driven Recommendations</p>
                    <ul className="space-y-2">
                      {[
                        analyticsDataReal?.draws?.draft_draws
                          ? `You have ${analyticsDataReal.draws.draft_draws} draft draw(s) — publish them to start accepting entries.`
                          : 'All draws are published.',
                        analyticsDataReal?.winners?.pending_claims
                          ? `${analyticsDataReal.winners.pending_claims} prize(s) pending claim — send reminder notifications.`
                          : 'All prizes have been settled.',
                        analyticsDataReal?.tokens?.total_tokens
                          ? `${analyticsDataReal.tokens.used_tokens || 0} of ${analyticsDataReal.tokens.total_tokens} tokens used. Monitor token allocation.`
                          : 'No tokens issued yet — create a draw to get started.',
                        analyticsDataReal?.draws?.active_draws
                          ? `${analyticsDataReal.draws.active_draws} active draw(s) running — ensure prizes are funded before draw date.`
                          : 'No active draws — open a draw to attract participants.',
                      ].map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="text-slate-400 mt-0.5 flex-shrink-0">→</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="text-xs font-mono">Copy Summary</Button>
                    <Button variant="outline" className="text-xs font-mono" onClick={() => handleReportExport('pdf')}>Export as PDF</Button>
                    <Button
                      variant="outline"
                      className="text-xs font-mono"
                      onClick={() => setSummaryGenerated(false)}
                    >
                      Regenerate
                    </Button>
                  </div>
                </motion.div>
              )}

              {!summaryGenerated && !summaryGenerating && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-24 border border-dashed border-primary/20 rounded-lg flex items-center justify-center"
                >
                  <p className="text-muted-foreground text-sm">
                    Click "Generate Summary" to create AI-powered insights from your {timeRange} data.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Custom Report Builder (NEW) ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
        >
          <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-foreground">Custom Report Builder</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Select metrics, configure options, and preview before exporting
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Metric Selection */}
              <div className="lg:col-span-2 space-y-3">
                <p className="text-xs font-mono text-muted-foreground uppercase">Select Metrics to Include</p>
                <div className="grid grid-cols-2 gap-2">
                  {REPORT_METRICS.map(metric => (
                    <button
                      key={metric.id}
                      onClick={() => toggleMetric(metric.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-all ${
                        selectedMetrics.includes(metric.id)
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-muted/30 border-primary/10 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center text-xs ${
                          selectedMetrics.includes(metric.id)
                            ? 'bg-white border-white text-slate-900'
                            : 'border-primary/30'
                        }`}
                      >
                        {selectedMetrics.includes(metric.id) ? <IconCheck size={12} stroke={3} /> : ''}
                      </span>
                      {metric.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Config Panel */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-xs font-mono text-muted-foreground uppercase">Date Range</p>
                  <div className="grid grid-cols-2 gap-1">
                    {(['7d', '30d', '90d', 'Custom'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setReportDateRange(r)}
                        className={`py-2 rounded text-xs font-mono transition-all ${
                          reportDateRange === r
                            ? 'bg-slate-800 text-white'
                            : 'border border-primary/20 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-mono text-muted-foreground uppercase">Output Format</p>
                  <div className="grid grid-cols-2 gap-1">
                    {(['pdf', 'excel'] as const).map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => setReportFormat(fmt)}
                        className={`py-2 rounded text-xs font-mono uppercase transition-all ${
                          reportFormat === fmt
                            ? 'bg-slate-800 text-white'
                            : 'border border-primary/20 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-mono text-muted-foreground uppercase">
                    Coverage: {selectedMetrics.length}/{REPORT_METRICS.length} metrics
                  </p>
                  <div className="h-1.5 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-slate-300 rounded transition-all duration-300"
                      style={{ width: `${(selectedMetrics.length / REPORT_METRICS.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => setShowPreview(true)}
                    disabled={selectedMetrics.length === 0}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-sm"
                  >
                    Preview Report
                  </Button>
                  <Button
                    variant="outline"
                    disabled={selectedMetrics.length === 0}
                    className="w-full font-mono text-sm"
                    onClick={() => handleReportExport(reportFormat)}
                  >
                    Export {reportFormat.toUpperCase()}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Scheduled Reports (NEW) ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Scheduled Reports</h3>
                <p className="text-sm text-muted-foreground mt-1">Automate report delivery on your schedule</p>
              </div>
              <Button
                onClick={() => setShowScheduleForm(v => !v)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-sm"
              >
                + New Schedule
              </Button>
            </div>

            {/* New Schedule Form */}
            <AnimatePresence>
              {showScheduleForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-muted/40 rounded-lg border border-primary/10 space-y-4">
                    <p className="text-xs font-mono text-muted-foreground uppercase">New Schedule Configuration</p>
                    <div className="grid md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Report Name</label>
                        <input
                          type="text"
                          value={newSchedule.name}
                          onChange={e => setNewSchedule(s => ({ ...s, name: e.target.value }))}
                          placeholder="e.g. Weekly Digest"
                          className="w-full px-3 py-2 bg-background border border-primary/20 rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-slate-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Frequency</label>
                        <select
                          value={newSchedule.frequency}
                          onChange={e => setNewSchedule(s => ({ ...s, frequency: e.target.value }))}
                          className="w-full px-3 py-2 bg-background border border-primary/20 rounded text-sm text-foreground focus:outline-none focus:border-slate-400"
                        >
                          <option>Daily</option>
                          <option>Weekly</option>
                          <option>Monthly</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Delivery Time</label>
                        <input
                          type="time"
                          value={newSchedule.time}
                          onChange={e => setNewSchedule(s => ({ ...s, time: e.target.value }))}
                          className="w-full px-3 py-2 bg-background border border-primary/20 rounded text-sm text-foreground focus:outline-none focus:border-slate-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Format</label>
                        <select
                          value={newSchedule.format}
                          onChange={e => setNewSchedule(s => ({ ...s, format: e.target.value }))}
                          className="w-full px-3 py-2 bg-background border border-primary/20 rounded text-sm text-foreground focus:outline-none focus:border-slate-400"
                        >
                          <option>PDF</option>
                          <option>Excel</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={addSchedule}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-xs"
                      >
                        Save Schedule
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowScheduleForm(false)}
                        className="font-mono text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Schedules List */}
            <div className="space-y-2">
              {schedules.map((schedule, idx) => (
                <motion.div
                  key={schedule.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-primary/10 hover:border-primary/20 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        schedule.active ? 'bg-green-400' : 'bg-muted-foreground'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{schedule.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {schedule.frequency}
                        {schedule.day !== '—' ? ` · ${schedule.day}` : ''}
                        {' · '}{schedule.time} · {schedule.format}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground font-mono">
                      {schedule.recipients} recipient{schedule.recipients !== 1 ? 's' : ''}
                    </span>
                    {/* Toggle */}
                    <button
                      onClick={() =>
                        setSchedules(prev =>
                          prev.map(s => s.id === schedule.id ? { ...s, active: !s.active } : s)
                        )
                      }
                      className={`relative w-10 h-5 rounded-full transition-all ${
                        schedule.active ? 'bg-slate-300' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                          schedule.active ? 'left-5' : 'left-0.5'
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => setSchedules(prev => prev.filter(s => s.id !== schedule.id))}
                      className="text-muted-foreground hover:text-red-400 text-xs transition-colors"
                    >
                      <IconX size={18} stroke={1.5} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Report Distribution Manager (NEW) ──────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
        >
          <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Distribution Manager</h3>
                <p className="text-sm text-muted-foreground mt-1">Manage who receives your automated reports</p>
              </div>
              <Button
                onClick={() => setShowAddRecipient(v => !v)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-sm"
              >
                + Add Recipient
              </Button>
            </div>

            {/* Add Recipient Form */}
            <AnimatePresence>
              {showAddRecipient && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-muted/40 rounded-lg border border-primary/10 space-y-4">
                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Full Name</label>
                        <input
                          type="text"
                          value={newRecipient.name}
                          onChange={e => setNewRecipient(r => ({ ...r, name: e.target.value }))}
                          placeholder="Jane Doe"
                          className="w-full px-3 py-2 bg-background border border-primary/20 rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-slate-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Email Address</label>
                        <input
                          type="email"
                          value={newRecipient.email}
                          onChange={e => setNewRecipient(r => ({ ...r, email: e.target.value }))}
                          placeholder="jane@org.com"
                          className="w-full px-3 py-2 bg-background border border-primary/20 rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-slate-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Role</label>
                        <select
                          value={newRecipient.role}
                          onChange={e => setNewRecipient(r => ({ ...r, role: e.target.value }))}
                          className="w-full px-3 py-2 bg-background border border-primary/20 rounded text-sm text-foreground focus:outline-none focus:border-slate-400"
                        >
                          <option>Executive</option>
                          <option>Admin</option>
                          <option>Manager</option>
                          <option>Analyst</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={addRecipient}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-xs"
                      >
                        Add Recipient
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowAddRecipient(false)}
                        className="font-mono text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recipients Table */}
            <div className="space-y-1">
              <div className="grid grid-cols-4 text-xs font-mono text-muted-foreground uppercase px-4 pb-2 border-b border-primary/10">
                <span>Name</span>
                <span>Email</span>
                <span>Role</span>
                <span>Subscriptions</span>
              </div>
              {recipients.map((recipient, idx) => (
                <motion.div
                  key={recipient.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="grid grid-cols-4 items-center p-4 rounded-lg bg-muted/20 hover:bg-muted/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700 flex-shrink-0">
                      {recipient.name.charAt(0)}
                    </div>
                    <span className="text-sm text-foreground">{recipient.name}</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground truncate pr-2">{recipient.email}</span>
                  <span
                    className={`text-xs font-mono px-2 py-0.5 rounded-full w-fit border ${
                      recipient.role === 'Executive'
                        ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                        : recipient.role === 'Admin'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        : recipient.role === 'Manager'
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-muted text-muted-foreground border-primary/20'
                    }`}
                  >
                    {recipient.role}
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-mono">
                      {recipient.reports.length} report{recipient.reports.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => setRecipients(prev => prev.filter(r => r.id !== recipient.id))}
                      className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Export Banner ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-primary/10 border border-primary/30 rounded-lg p-6 flex items-center justify-between"
        >
          <div>
            <h3 className="font-bold text-foreground">Export Reports</h3>
            <p className="text-sm text-muted-foreground">Download detailed analytics in PDF or Excel format</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleReportExport('pdf')}>PDF</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => handleReportExport('excel')}>Excel</Button>
          </div>
        </motion.div>

        {/* ── Report Preview Modal (NEW) ─────────────────────────────────── */}
        <AnimatePresence>
          {showPreview && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
              onClick={() => setShowPreview(false)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-card border border-primary/20 rounded-xl p-8 max-w-2xl w-full max-h-[80vh] overflow-auto space-y-6"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Report Preview</h3>
                    <p className="text-sm text-muted-foreground font-mono mt-1">
                      {reportDateRange} · {selectedMetrics.length} sections · {reportFormat.toUpperCase()}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-muted-foreground hover:text-foreground text-xl transition-colors"
                  >
                    <IconX size={18} stroke={1.5} />
                  </button>
                </div>

                {/* Mock rendered report */}
                <div className="border border-primary/20 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="h-3 w-48 bg-foreground/20 rounded" />
                        <div className="h-2 w-32 bg-muted-foreground/30 rounded" />
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">
                        Generated: {new Date().toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="p-6 space-y-5">
                    {selectedMetrics.map((metricId, idx) => {
                      const metric = REPORT_METRICS.find(m => m.id === metricId);
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          className="space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-4 bg-slate-300 rounded" />
                            <p className="text-sm font-bold text-foreground">{metric?.label}</p>
                          </div>
                          <div className="h-16 bg-muted/40 rounded flex items-center justify-center">
                            <span className="text-xs text-muted-foreground font-mono">
                              [{metric?.label} visualization]
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1 bg-slate-800 text-white hover:bg-slate-700 font-mono"
                    onClick={() => { handleReportExport(reportFormat); setShowPreview(false); }}>
                    Export {reportFormat.toUpperCase()}
                  </Button>
                  <Button variant="outline" onClick={() => setShowPreview(false)} className="font-mono">
                    Close
                  </Button>
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