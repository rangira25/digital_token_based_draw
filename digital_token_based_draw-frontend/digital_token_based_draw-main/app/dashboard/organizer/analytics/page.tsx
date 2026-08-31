'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { api, apiUrls } from '@/lib/api';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { IconTrendingUp, IconAlertTriangle, IconEye, IconX, IconCheck } from '@tabler/icons-react';

// ─── Data by Time Range (makes the filter actually functional) ─────────────
const analyticsData = {
  '24h': {
    kpis: [
      { label: 'Total Participants', value: '1,842', change: '+3.2%', trend: 'up' },
      { label: 'Active Draws', value: '24', change: '+0%', trend: 'up' },
      { label: 'Total Tokens', value: '18,420', change: '-0.8%', trend: 'down' },
      { label: 'Avg Entries/Draw', value: '77', change: '+2.1%', trend: 'up' },
      { label: 'Prize Claim Rate', value: '91.0%', change: '+1.2%', trend: 'up' },
      { label: 'Revenue (Est.)', value: '$6,240', change: '+5.1%', trend: 'up' },
    ],
    participation: [
      { label: '6am', value: 120 },
      { label: '9am', value: 280 },
      { label: '12pm', value: 450 },
      { label: '3pm', value: 390 },
      { label: '6pm', value: 510 },
      { label: '9pm', value: 620 },
      { label: '12am', value: 210 },
    ],
    entryVolume: [
      { label: '6am', entries: 240, unique: 120 },
      { label: '9am', entries: 560, unique: 280 },
      { label: '12pm', entries: 900, unique: 450 },
      { label: '3pm', entries: 780, unique: 390 },
      { label: '6pm', entries: 1020, unique: 510 },
      { label: '9pm', entries: 1240, unique: 620 },
      { label: '12am', entries: 420, unique: 210 },
    ],
  },
  '7d': {
    kpis: [
      { label: 'Total Participants', value: '12,450', change: '+8.5%', trend: 'up' },
      { label: 'Active Draws', value: '24', change: '+12.3%', trend: 'up' },
      { label: 'Total Tokens', value: '125,680', change: '-2.1%', trend: 'down' },
      { label: 'Avg Entries/Draw', value: '520', change: '+5.2%', trend: 'up' },
      { label: 'Prize Claim Rate', value: '94.2%', change: '+3.8%', trend: 'up' },
      { label: 'Revenue (Est.)', value: '$45,320', change: '+18.6%', trend: 'up' },
    ],
    participation: [
      { label: 'May 7', value: 850 },
      { label: 'May 8', value: 920 },
      { label: 'May 9', value: 1100 },
      { label: 'May 10', value: 1450 },
      { label: 'May 11', value: 1320 },
      { label: 'May 12', value: 1680 },
      { label: 'May 13', value: 1900 },
    ],
    entryVolume: [
      { label: 'May 7', entries: 1700, unique: 850 },
      { label: 'May 8', entries: 1840, unique: 920 },
      { label: 'May 9', entries: 2200, unique: 1100 },
      { label: 'May 10', entries: 2900, unique: 1450 },
      { label: 'May 11', entries: 2640, unique: 1320 },
      { label: 'May 12', entries: 3360, unique: 1680 },
      { label: 'May 13', entries: 3800, unique: 1900 },
    ],
  },
  '30d': {
    kpis: [
      { label: 'Total Participants', value: '48,920', change: '+22.1%', trend: 'up' },
      { label: 'Active Draws', value: '89', change: '+34.0%', trend: 'up' },
      { label: 'Total Tokens', value: '512,400', change: '+11.3%', trend: 'up' },
      { label: 'Avg Entries/Draw', value: '549', change: '+9.8%', trend: 'up' },
      { label: 'Prize Claim Rate', value: '92.8%', change: '+2.1%', trend: 'up' },
      { label: 'Revenue (Est.)', value: '$182,600', change: '+28.4%', trend: 'up' },
    ],
    participation: [
      { label: 'Apr 15', value: 1200 },
      { label: 'Apr 19', value: 1580 },
      { label: 'Apr 23', value: 1820 },
      { label: 'Apr 27', value: 2100 },
      { label: 'May 1', value: 1950 },
      { label: 'May 5', value: 2380 },
      { label: 'May 9', value: 2740 },
    ],
    entryVolume: [
      { label: 'Apr 15', entries: 2400, unique: 1200 },
      { label: 'Apr 19', entries: 3160, unique: 1580 },
      { label: 'Apr 23', entries: 3640, unique: 1820 },
      { label: 'Apr 27', entries: 4200, unique: 2100 },
      { label: 'May 1', entries: 3900, unique: 1950 },
      { label: 'May 5', entries: 4760, unique: 2380 },
      { label: 'May 9', entries: 5480, unique: 2740 },
    ],
  },
  '90d': {
    kpis: [
      { label: 'Total Participants', value: '142,300', change: '+45.2%', trend: 'up' },
      { label: 'Active Draws', value: '247', change: '+61.8%', trend: 'up' },
      { label: 'Total Tokens', value: '1,482,000', change: '+38.9%', trend: 'up' },
      { label: 'Avg Entries/Draw', value: '576', change: '+18.3%', trend: 'up' },
      { label: 'Prize Claim Rate', value: '91.4%', change: '-0.6%', trend: 'down' },
      { label: 'Revenue (Est.)', value: '$528,400', change: '+52.1%', trend: 'up' },
    ],
    participation: [
      { label: 'Feb', value: 12400 },
      { label: 'Mar W1', value: 18200 },
      { label: 'Mar W2', value: 22800 },
      { label: 'Mar W3', value: 28400 },
      { label: 'Apr W1', value: 34100 },
      { label: 'Apr W2', value: 42600 },
      { label: 'May', value: 48920 },
    ],
    entryVolume: [
      { label: 'Feb', entries: 24800, unique: 12400 },
      { label: 'Mar W1', entries: 36400, unique: 18200 },
      { label: 'Mar W2', entries: 45600, unique: 22800 },
      { label: 'Mar W3', entries: 56800, unique: 28400 },
      { label: 'Apr W1', entries: 68200, unique: 34100 },
      { label: 'Apr W2', entries: 85200, unique: 42600 },
      { label: 'May', entries: 97840, unique: 48920 },
    ],
  },
};

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
    { label: 'Total Participants', value: String(analyticsDataReal.users?.total || analyticsDataReal.draws?.total_draws || '—'), change: '', trend: 'up' },
    { label: 'Active Draws', value: String(analyticsDataReal.draws?.active_draws || '—'), change: '', trend: 'up' },
    { label: 'Total Entries', value: String(analyticsDataReal.entries?.total_entries || '—'), change: '', trend: 'up' },
    { label: 'Active Tokens', value: String(analyticsDataReal.tokens?.active_tokens || '—'), change: '', trend: 'up' },
    { label: 'Total Users', value: String(analyticsDataReal.users?.total || '—'), change: '', trend: 'up' },
    { label: 'Winners', value: String(analyticsDataReal.draws?.completed_draws || '—'), change: '', trend: 'up' },
  ] : null;

  const currentData = mergedKpis ? { ...analyticsData[timeRange], kpis: mergedKpis } : analyticsData[timeRange];
  const maxParticipation = Math.max(...currentData.participation.map(d => d.value));
  const maxEntries = Math.max(...currentData.entryVolume.map(d => d.entries));
  const peakDay = currentData.entryVolume.reduce((max, d) => d.entries > max.entries ? d : max);
  const avgMultiplier = (
    currentData.entryVolume.reduce((a, b) => a + b.entries, 0) /
    currentData.entryVolume.reduce((a, b) => a + b.unique, 0)
  ).toFixed(1);

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
              {[
                { name: 'Summer Prize Draw', entries: 2840, fill: 95 },
                { name: 'Tech Raffle', entries: 2120, fill: 71 },
                { name: 'Community Giveaway', entries: 1950, fill: 65 },
                { name: 'Spring Promotion', entries: 1680, fill: 56 },
                { name: 'Monthly Raffle', entries: 1240, fill: 42 },
              ].map((draw, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{draw.name}</span>
                    <span className="text-slate-700 font-mono">{draw.entries.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-muted rounded overflow-hidden">
                    <motion.div
                      className="h-full bg-slate-300 rounded"
                      initial={{ width: 0 }}
                      animate={{ width: `${draw.fill}%` }}
                      transition={{ delay: idx * 0.08, duration: 0.5 }}
                    />
                  </div>
                </div>
              ))}
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
          {/* Winner Demographics (enhanced) */}
          <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-4">
            <h3 className="text-lg font-bold text-foreground">Winner Demographics</h3>
            <div className="space-y-3">
              {[
                { label: 'Age 18-25', percentage: 22 },
                { label: 'Age 26-35', percentage: 38 },
                { label: 'Age 36-45', percentage: 28 },
                { label: 'Age 46+', percentage: 12 },
              ].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{item.label}</span>
                    <span className="text-muted-foreground font-mono">{item.percentage}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded"
                      initial={{ width: 0 }}
                      animate={{ width: `${item.percentage}%` }}
                      transition={{ delay: idx * 0.08, duration: 0.5 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-primary/10 grid grid-cols-2 gap-3">
              {[
                { label: 'Male Winners', value: '54%' },
                { label: 'Female Winners', value: '43%' },
                { label: 'Top Region', value: 'West' },
                { label: 'Repeat Winners', value: '18%' },
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
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Claimed', value: 2450, color: 'text-green-400' },
                { label: 'Pending', value: 145, color: 'text-yellow-400' },
                { label: 'Unclaimed', value: 32, color: 'text-red-400' },
                { label: 'Expired', value: 8, color: 'text-gray-400' },
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
                <span className="font-mono text-foreground">94.2%</span>
              </div>
              <div className="h-3 bg-muted rounded overflow-hidden flex">
                <div className="h-full bg-green-500/70 rounded-l" style={{ width: '94.2%' }} />
                <div className="h-full bg-yellow-500/70" style={{ width: '2.6%' }} />
                <div className="h-full bg-red-500/70" style={{ width: '1.2%' }} />
                <div className="h-full bg-gray-500/70 rounded-r" style={{ width: '0.15%' }} />
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground font-mono">
                <span>Avg claim time: 2.4 days</span>
                <span>Fastest: 8 min</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Organizer Performance Metrics (NEW) ────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Organizer Performance</h3>
                <p className="text-sm text-muted-foreground mt-1">Your metrics vs. platform average</p>
              </div>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-mono rounded-full border border-green-500/30">
                Top 10% Organizer
              </span>
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Overall Score', value: '92/100', sub: '+4 vs last period', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                { label: 'Draws Created', value: '89', sub: 'This period', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
                { label: 'Success Rate', value: '97.8%', sub: 'Draws completed', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                { label: 'Avg Response', value: '1.2h', sub: 'To participant queries', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
              ].map((card, idx) => (
                <div key={idx} className={`p-4 rounded-lg border space-y-2 ${card.bg}`}>
                  <p className="text-xs text-muted-foreground font-mono uppercase">{card.label}</p>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Benchmark Comparison */}
            <div className="space-y-4">
              <p className="text-xs font-mono text-muted-foreground uppercase">You vs. Platform Average</p>
              {[
                { metric: 'Participant Satisfaction', you: 96, avg: 82 },
                { metric: 'Draw Completion Rate', you: 98, avg: 89 },
                { metric: 'Prize Distribution Speed', you: 88, avg: 74 },
                { metric: 'Engagement Score', you: 91, avg: 76 },
                { metric: 'Repeat Participation', you: 72, avg: 58 },
              ].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{item.metric}</span>
                    <div className="flex gap-4 font-mono text-xs">
                      <span className="text-slate-700">You: {item.you}%</span>
                      <span className="text-muted-foreground">Avg: {item.avg}%</span>
                    </div>
                  </div>
                  <div className="h-4 bg-muted rounded overflow-hidden relative">
                    <motion.div
                      className="h-full bg-muted-foreground/40 rounded absolute"
                      initial={{ width: 0 }}
                      animate={{ width: `${item.avg}%` }}
                      transition={{ delay: idx * 0.07, duration: 0.5 }}
                    />
                    <motion.div
                      className="h-full bg-slate-400 rounded absolute"
                      initial={{ width: 0 }}
                      animate={{ width: `${item.you}%` }}
                      transition={{ delay: idx * 0.07 + 0.1, duration: 0.5 }}
                    />
                  </div>
                </div>
              ))}
            </div>
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
                      Over the past {timeRange}, your draws saw{' '}
                      <strong className="text-slate-700">{currentData.kpis[0].value} participants</strong>{' '}
                      across{' '}
                      <strong className="text-slate-700">{currentData.kpis[1].value} active draws</strong>.{' '}
                      Revenue is tracking at{' '}
                      <strong className="text-slate-700">{currentData.kpis[5].value}</strong> — a{' '}
                      {currentData.kpis[5].change} increase over the previous period.
                    </p>
                  </div>

                  {/* Insight Cards */}
                  <div className="grid md:grid-cols-3 gap-4">
                    {[
                      {
                        icon: 'trendUp',
                        title: 'Top Performer',
                        body: 'Summer Prize Draw leads with 2,840 entries at 95% capacity — consider running a follow-up.',
                        type: 'positive',
                      },
                      {
                        icon: 'alertTriangle',
                        title: 'Action Required',
                        body: '32 prizes remain unclaimed and 8 have expired. Trigger a re-notification campaign.',
                        type: 'warning',
                      },
                      {
                        icon: 'eye',
                        title: 'Optimization',
                        body: `Peak entries at ${peakDay.label}. Schedule draw launches around this window for maximum reach.`,
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
                        'Increase token allocation by 15% for Tech Raffle — demand significantly outpaced supply.',
                        'Age 26-35 (38%) is your highest-engaging group — prioritize prizes that appeal to this demographic.',
                        `Claim rate of 94.2% is above average — your reminder cadence is working. Maintain it.`,
                        'Response time of 1.2h places you top 10% — sustain this for continued high satisfaction scores.',
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
                    <Button variant="outline" className="text-xs font-mono">Export as PDF</Button>
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
            <Button variant="outline">PDF</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Excel</Button>
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
                  <Button className="flex-1 bg-slate-800 text-white hover:bg-slate-700 font-mono">
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