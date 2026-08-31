'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { Button } from '@/components/ui/button';
import { api, apiUrls } from '@/lib/api';
import { IconStar, IconDiamond, IconSpeakerphone, IconClock, IconCheck, IconBell, IconBellOff, IconMail, IconPhone, IconSettings, IconX } from '@tabler/icons-react';
import { Pagination } from '@/components/Pagination';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: 'win' | 'draw' | 'announcement' | 'reminder' | 'confirmation';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  readAt?: string;
  drawName?: string;
  actionUrl?: string;
  channel?: 'in-app' | 'email' | 'sms';
}

interface NotificationPreferences {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  winAlerts: boolean;
  drawReminders: boolean;
  entryConfirmations: boolean;
  announcements: boolean;
  emailAddress: string;
  phoneNumber: string;
}

interface Toast {
  id: string;
  type: Notification['type'];
  title: string;
  message: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'win',
    title: 'Congratulations!',
    message: 'You won $500 Gift Card in Community Recognition draw',
    timestamp: '2026-05-01 14:30:22',
    read: false,
    drawName: 'Community Recognition',
    actionUrl: '/dashboard/participant/results',
    channel: 'in-app',
  },
  {
    id: 'n2',
    type: 'draw',
    title: 'New Draw Available',
    message: 'Product Launch Giveaway is now open for entries',
    timestamp: '2026-05-10 09:15:00',
    read: false,
    drawName: 'Product Launch Giveaway',
    actionUrl: '/dashboard/participant/draws',
    channel: 'email',
  },
  {
    id: 'n3',
    type: 'confirmation',
    title: 'Entry Confirmed',
    message: 'Your entry for Community Recognition has been received. Good luck!',
    timestamp: '2026-05-08 16:45:30',
    read: false,
    drawName: 'Community Recognition',
    channel: 'in-app',
  },
  {
    id: 'n4',
    type: 'reminder',
    title: 'Draw Ending Soon',
    message: 'Community Recognition ends in 2 days. Enter now before it closes.',
    timestamp: '2026-05-08 10:00:00',
    read: true,
    readAt: '2026-05-08 11:22:10',
    drawName: 'Community Recognition',
    actionUrl: '/dashboard/participant/draws',
    channel: 'sms',
  },
  {
    id: 'n5',
    type: 'announcement',
    title: 'System Maintenance',
    message: 'Scheduled maintenance on May 15 from 2:00 AM to 4:00 AM UTC',
    timestamp: '2026-05-07 12:00:00',
    read: true,
    readAt: '2026-05-07 13:05:44',
    channel: 'in-app',
  },
  {
    id: 'n6',
    type: 'draw',
    title: 'Draw Results Published',
    message: 'Winners announced for Spring Giveaway 2026',
    timestamp: '2026-05-05 11:30:15',
    read: true,
    readAt: '2026-05-05 12:00:00',
    drawName: 'Spring Giveaway 2026',
    actionUrl: '/dashboard/participant/results',
    channel: 'email',
  },
  {
    id: 'n7',
    type: 'reminder',
    title: 'Claim Your Prize',
    message: 'Your $500 Gift Card from Spring Giveaway 2026 expires in 7 days. Click to view claim instructions.',
    timestamp: '2026-05-02 08:00:00',
    read: true,
    readAt: '2026-05-02 09:14:33',
    drawName: 'Spring Giveaway 2026',
    actionUrl: '/dashboard/participant/prizes/claim',
    channel: 'sms',
  },
];

const defaultPreferences: NotificationPreferences = {
  inApp: true,
  email: true,
  sms: false,
  winAlerts: true,
  drawReminders: true,
  entryConfirmations: true,
  announcements: false,
  emailAddress: 'participant@example.com',
  phoneNumber: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByDate(notifications: Notification[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: { label: string; items: Notification[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This Week', items: [] },
    { label: 'Earlier', items: [] },
  ];

  notifications.forEach(n => {
    const d = new Date(n.timestamp);
    d.setHours(0, 0, 0, 0);
    if (d >= today) groups[0].items.push(n);
    else if (d >= yesterday) groups[1].items.push(n);
    else if (d >= weekAgo) groups[2].items.push(n);
    else groups[3].items.push(n);
  });

  return groups.filter(g => g.items.length > 0);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const iconMap: Record<string, React.ComponentType<any>> = {
  star: IconStar, diamond: IconDiamond, speakerphone: IconSpeakerphone,
  clock: IconClock, check: IconCheck, bell: IconBell, mail: IconMail, phone: IconPhone,
};

const typeConfig = {
  win:          { icon: 'star', color: 'bg-slate-50 border-slate-200',       label: 'Win' },
  draw:         { icon: 'diamond',  color: 'bg-primary/10 border-primary/30',     label: 'Draw' },
  announcement: { icon: 'speakerphone', color: 'bg-blue-500/10 border-blue-500/30',   label: 'Announcement' },
  reminder:     { icon: 'clock', color: 'bg-yellow-500/10 border-yellow-500/30', label: 'Reminder' },
  confirmation: { icon: 'check', color: 'bg-green-500/10 border-green-500/30', label: 'Confirmation' },
};

const channelBadge: Record<string, string> = {
  'in-app': 'bg-primary/10 text-primary',
  email:    'bg-blue-500/10 text-blue-500',
  sms:      'bg-green-500/10 text-green-600',
};

function ToastAlert({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const cfg = typeConfig[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg bg-card ${cfg.color} max-w-sm w-full`}
    >
      <span className="text-xl text-muted-foreground">{(() => { const Ic = iconMap[cfg.icon]; return Ic ? <Ic size={20} stroke={1.5} /> : null; })()}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground">{toast.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-muted-foreground hover:text-foreground text-xs ml-2 flex-shrink-0"
      >
        <IconX size={14} stroke={2} />
      </button>
    </motion.div>
  );
}

function PreferencesPanel({
  prefs,
  onChange,
  onClose,
}: {
  prefs: NotificationPreferences;
  onChange: (p: NotificationPreferences) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState(prefs);
  const toggle = (key: keyof NotificationPreferences) =>
    setLocal(p => ({ ...p, [key]: !p[key as keyof typeof p] }));

  const handleSave = () => { onChange(local); onClose(); };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      className="fixed inset-y-0 right-0 w-96 bg-card border-l border-primary/20 shadow-2xl z-50 flex flex-col"
    >
      <div className="flex items-center justify-between p-6 border-b border-primary/10">
        <h2 className="text-lg font-bold text-foreground">Notification Preferences</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><IconX size={18} stroke={1.5} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Channels */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Channels</h3>
          <div className="space-y-3">
            {([
              { key: 'inApp' as const, label: 'In-App', icon: 'bell', desc: 'Alerts inside the dashboard' },
              { key: 'email' as const, label: 'Email',  icon: 'mail', desc: local.emailAddress },
              { key: 'sms'   as const, label: 'SMS',    icon: 'phone', desc: local.phoneNumber || 'No number saved' },
            ]).map(ch => (
              <div key={ch.key} className="flex items-center justify-between p-3 rounded-lg bg-background border border-primary/10">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{(() => { const Ic = iconMap[ch.icon]; return Ic ? <Ic size={18} stroke={1.5} /> : null; })()}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{ch.label}</p>
                    <p className="text-xs text-muted-foreground">{ch.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggle(ch.key)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${local[ch.key] ? 'bg-slate-900' : 'bg-muted'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${local[ch.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Email / Phone */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contact Details</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email address</label>
              <input
                type="email"
                value={local.emailAddress}
                onChange={e => setLocal(p => ({ ...p, emailAddress: e.target.value }))}
                className="w-full bg-background border border-primary/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Phone number (SMS)</label>
              <input
                type="tel"
                placeholder="+1 555 000 0000"
                value={local.phoneNumber}
                onChange={e => setLocal(p => ({ ...p, phoneNumber: e.target.value }))}
                className="w-full bg-background border border-primary/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>
        </div>

        {/* Notification types */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Notification Types</h3>
          <div className="space-y-2">
            {([
              { key: 'winAlerts'           as const, label: 'Win alerts',           icon: 'star' },
              { key: 'drawReminders'       as const, label: 'Draw reminders',       icon: 'clock' },
              { key: 'entryConfirmations'  as const, label: 'Entry confirmations',  icon: 'check' },
              { key: 'announcements'       as const, label: 'Announcements',        icon: 'speakerphone' },
            ]).map(item => (
              <div key={item.key} className="flex items-center justify-between py-2">
                <span className="text-sm text-foreground flex items-center gap-2">
                  <span className="text-muted-foreground">{(() => { const Ic = iconMap[item.icon]; return Ic ? <Ic size={16} stroke={1.5} /> : null; })()}</span> {item.label}
                </span>
                <button
                  onClick={() => toggle(item.key)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${local[item.key] ? 'bg-slate-900' : 'bg-muted'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${local[item.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Channel status */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Integration Status</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <span className="text-sm text-foreground flex items-center gap-2"><IconMail size={16} stroke={1.5} /> Email</span>
              <span className="text-xs font-medium text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">Connected</span>
            </div>
            <div className={`flex items-center justify-between p-3 rounded-lg ${local.phoneNumber ? 'bg-green-500/5 border-green-500/20' : 'bg-yellow-500/5 border-yellow-500/20'} border`}>
              <span className="text-sm text-foreground flex items-center gap-2"><IconPhone size={16} stroke={1.5} /> SMS</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${local.phoneNumber ? 'text-green-600 bg-green-500/10' : 'text-yellow-600 bg-yellow-500/10'}`}>
                {local.phoneNumber ? 'Connected' : 'Not configured'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-primary/10 flex gap-3">
        <Button onClick={onClose} variant="outline" className="flex-1 border-primary/20">Cancel</Button>
        <Button onClick={handleSave} className="flex-1 bg-slate-900 text-white hover:bg-slate-800">Save</Button>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'win' | 'draw' | 'confirmation' | 'reminder'>('all');
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultPreferences);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [apiError, setApiError] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'participant') router.push('/auth');
  }, [user, isLoading, router]);

  // Fetch notifications from API
  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      try {
        const res = await api<{ success: boolean; data: any[] }>(apiUrls.notifications.list);
        const mapped: Notification[] = (res.data || []).map((n: any) => ({
          id: n.id,
          type: (n.type === 'win' || n.type === 'draw' || n.type === 'announcement' || n.type === 'reminder' || n.type === 'confirmation' ? n.type : 'announcement') as Notification['type'],
          title: n.title,
          message: n.message,
          timestamp: n.created_at?.replace('T', ' ').slice(0, 19) || '',
          read: n.read,
          readAt: n.read_at || undefined,
          drawName: n.draw_title || undefined,
          actionUrl: n.action_url || undefined,
          channel: n.channel || 'in-app',
        }));
        setNotifications(mapped);
      } catch {}
    };
    fetchNotifications();
  }, [user]);

  const filteredNotifications = notifications.filter(n => {
    if (filterType === 'all') return true;
    if (filterType === 'unread') return !n.read;
    return n.type === filterType;
  });

  const totalPages = Math.ceil(filteredNotifications.length / PAGE_SIZE);
  const paginatedNotifications = filteredNotifications.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const grouped = groupByDate(paginatedNotifications);
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      await api(apiUrls.notifications.markRead(id), { method: 'POST' });
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      setNotifications(prev => prev.map(n =>
        n.id === id ? { ...n, read: true, readAt: now } : n
      ));
    } catch {}
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api(apiUrls.notifications.markAllRead, { method: 'POST' });
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      setNotifications(prev => prev.map(n => ({ ...n, read: true, readAt: n.readAt ?? now })));
    } catch {}
  };

  const handleDelete = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      {/* Toast container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map(toast => (
            <ToastAlert key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>

      {/* Preferences panel backdrop */}
      <AnimatePresence>
        {showPrefs && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setShowPrefs(false)}
            />
            <PreferencesPanel prefs={prefs} onChange={setPrefs} onClose={() => setShowPrefs(false)} />
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-foreground">Notifications</h1>
                <p className="text-muted-foreground mt-1">Stay updated on draws, wins, and announcements</p>
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <>
                    <span className="bg-slate-900 text-white text-sm font-bold px-3 py-1 rounded-full">
                      {unreadCount} New
                    </span>
                    <Button onClick={handleMarkAllAsRead} variant="outline" className="border-primary/20" size="sm">
                      Mark All Read
                    </Button>
                  </>
                )}
                <Button onClick={() => setShowPrefs(true)} variant="outline" className="border-primary/20" size="sm">
                  <IconSettings size={16} stroke={1.5} /> Preferences
                </Button>
              </div>
            </div>

            {/* Channel status strip */}
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs text-muted-foreground">Active channels:</span>
              {prefs.inApp  && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1"><IconBell size={12} stroke={2} /> In-App</span>}
              {prefs.email  && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium flex items-center gap-1"><IconMail size={12} stroke={2} /> Email</span>}
              {prefs.sms    && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium flex items-center gap-1"><IconPhone size={12} stroke={2} /> SMS</span>}
              {!prefs.inApp && !prefs.email && !prefs.sms && (
                <span className="text-xs text-destructive">All channels disabled</span>
              )}
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex gap-2 flex-wrap">
            {([
              { value: 'all'          as const, label: 'All' },
              { value: 'unread'       as const, label: 'Unread' },
              { value: 'win'          as const, label: 'Wins',           icon: 'star' },
              { value: 'confirmation' as const, label: 'Confirmations',  icon: 'check' },
              { value: 'reminder'     as const, label: 'Reminders',      icon: 'clock' },
              { value: 'draw'         as const, label: 'Draws',          icon: 'diamond' },
            ]).map(filter => (
              <Button
                key={filter.value}
                onClick={() => { setFilterType(filter.value); setPage(1); }}
                variant={filterType === filter.value ? 'default' : 'outline'}
                className={filterType === filter.value ? 'bg-slate-900 text-white' : 'border-primary/20'}
                size="sm"
              >
                {filter.icon && (() => { const Ic = iconMap[filter.icon]; return Ic ? <><Ic size={14} stroke={1.5} /> </> : null; })()}{filter.label}
              </Button>
            ))}
          </motion.div>

          {/* Grouped notification list */}
          <div className="space-y-6">
            {grouped.map((group, gIdx) => (
              <motion.div
                key={group.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + gIdx * 0.05 }}
              >
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">
                  {group.label}
                </h2>
                <div className="space-y-3">
                  {group.items.map((notif, idx) => {
                    const cfg = typeConfig[notif.type];
                    return (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className={`border rounded-lg p-5 transition-all duration-300 ${
                          notif.read
                            ? 'bg-card border-primary/10 opacity-80'
                            : `${cfg.color} border-2`
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="text-2xl pt-1 text-muted-foreground">{(() => { const Ic = iconMap[cfg.icon]; return Ic ? <Ic size={24} stroke={1.5} /> : null; })()}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div>
                                <h3 className={`font-bold ${notif.read ? 'text-foreground/80' : 'text-foreground'}`}>
                                  {notif.title}
                                </h3>
                                <p className={`text-sm mt-1 ${notif.read ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                                  {notif.message}
                                </p>
                              </div>
                              {!notif.read && <div className="flex-shrink-0 w-2 h-2 bg-slate-400 rounded-full mt-2" />}
                            </div>

                            {notif.drawName && (
                              <p className="text-xs text-primary font-medium mb-3">{notif.drawName}</p>
                            )}

                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground font-mono">{notif.timestamp}</span>
                                {notif.channel && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${channelBadge[notif.channel]}`}>
                                    {notif.channel === 'in-app' ? <IconBell size={12} stroke={2} /> : notif.channel === 'email' ? <IconMail size={12} stroke={2} /> : <IconPhone size={12} stroke={2} />} {notif.channel}
                                  </span>
                                )}
                                {notif.read && notif.readAt && (
                                  <span className="text-xs text-muted-foreground/50 italic">Read {notif.readAt}</span>
                                )}
                              </div>

                              <div className="flex gap-2">
                                {notif.actionUrl && (
                                  <Button
                                    onClick={() => { handleMarkAsRead(notif.id); router.push(notif.actionUrl!); }}
                                    className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                                    variant="outline"
                                    size="sm"
                                  >
                                    {notif.type === 'reminder' && notif.title.includes('Claim') ? 'Claim Prize' : 'View'}
                                  </Button>
                                )}
                                {!notif.read && (
                                  <Button
                                    onClick={() => handleMarkAsRead(notif.id)}
                                    className="bg-primary/20 text-primary hover:bg-primary/30"
                                    variant="outline"
                                    size="sm"
                                  >
                                    Mark Read
                                  </Button>
                                )}
                                <Button
                                  onClick={() => handleDelete(notif.id)}
                                  className="text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                  variant="ghost"
                                  size="sm"
                                >
                                  <IconX size={14} stroke={2} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination page={page} totalItems={filteredNotifications.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          )}

          {filteredNotifications.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-card border border-primary/20 rounded-lg"
            >
              <IconBellOff className="mx-auto mb-4 text-muted-foreground" size={40} stroke={1} />
              <p className="text-muted-foreground mb-4">No notifications at this time.</p>
              <Button onClick={() => setFilterType('all')} variant="outline" className="border-primary/20">
                Reset Filters
              </Button>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Button onClick={() => router.back()} variant="outline" className="border-primary/20">
              Back to Dashboard
            </Button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}