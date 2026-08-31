'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/Pagination';
import { api, apiUrls } from '@/lib/api';
import { IconBell, IconMail, IconPhone, IconClipboardList, IconFileText, IconSettings, IconStar, IconClock, IconCheck, IconX } from '@tabler/icons-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Channel = 'in-app' | 'email' | 'sms';
type MessageType = 'announcement' | 'reminder' | 'winner' | 'confirmation';
type Tab = 'compose' | 'history' | 'templates' | 'settings';

interface Template {
  id: string;
  name: string;
  type: MessageType;
  subject: string;
  body: string;
  channels: Channel[];
}

interface HistoryEntry {
  id: string;
  subject: string;
  body: string;
  type: MessageType;
  channels: Channel[];
  sentAt: string;
  recipients: number;
  opened: number;
  clicked: number;
  drawName?: string;
}

interface ChannelStatus {
  id: Channel;
  label: string;
  icon: string;
  connected: boolean;
  detail: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockTemplates: Template[] = [
  {
    id: 't1',
    name: 'Winner Announcement',
    type: 'winner',
    subject: 'Congratulations — You Won {{draw_name}}!',
    body: 'Hi {{first_name}},\n\nGreat news! You have been selected as a winner in {{draw_name}}.\n\nYour prize: {{prize_description}}\n\nTo claim your prize, please visit your dashboard within {{claim_days}} days.\n\nCongratulations!\n{{org_name}}',
    channels: ['in-app', 'email'],
  },
  {
    id: 't2',
    name: 'Draw Reminder',
    type: 'reminder',
    subject: '{{draw_name}} closes in {{days_left}} days',
    body: 'Hi {{first_name}},\n\nThis is a reminder that {{draw_name}} closes on {{close_date}}.\n\nDon\'t miss your chance to enter!\n\n{{org_name}}',
    channels: ['in-app', 'sms'],
  },
  {
    id: 't3',
    name: 'Entry Confirmation',
    type: 'confirmation',
    subject: 'Entry confirmed for {{draw_name}}',
    body: 'Hi {{first_name}},\n\nYour entry for {{draw_name}} has been confirmed.\n\nEntry ID: {{entry_id}}\nDraw date: {{draw_date}}\n\nGood luck!\n{{org_name}}',
    channels: ['in-app', 'email'],
  },
  {
    id: 't4',
    name: 'General Announcement',
    type: 'announcement',
    subject: '{{subject}}',
    body: 'Hi {{first_name}},\n\n{{message_body}}\n\n{{org_name}}',
    channels: ['in-app', 'email', 'sms'],
  },
];



const channelStatuses: ChannelStatus[] = [
  { id: 'in-app', label: 'In-App',      icon: 'bell', connected: true,  detail: 'Platform native — always active' },
  { id: 'email',  label: 'Email (SMTP)', icon: 'mail', connected: true,  detail: 'smtp.sendgrid.net · verified' },
  { id: 'sms',    label: 'SMS (Twilio)', icon: 'phone', connected: false, detail: 'Not configured — add API key' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const typeColors: Record<MessageType, string> = {
  winner:       'bg-primary/10 text-primary',
  reminder:     'bg-yellow-500/10 text-yellow-600',
  announcement: 'bg-blue-500/10 text-blue-500',
  confirmation: 'bg-green-500/10 text-green-600',
};

const typeIcons: Record<MessageType, string> = {
  winner: 'star', reminder: 'clock', announcement: 'speakerphone', confirmation: 'check',
};

const channelBadgeColors: Record<Channel, string> = {
  'in-app': 'bg-primary/10 text-primary',
  email:    'bg-blue-500/10 text-blue-500',
  sms:      'bg-green-500/10 text-green-600',
};

function pct(a: number, b: number) {
  return b === 0 ? '0' : Math.round((a / b) * 100) + '%';
}

// ─── Compose Panel ────────────────────────────────────────────────────────────

function ComposePanel({ templates }: { templates: Template[] }) {
  const [subject, setSubject]   = useState('');
  const [body, setBody]         = useState('');
  const [msgType, setMsgType]   = useState<MessageType>('announcement');
  const [channels, setChannels] = useState<Channel[]>(['in-app']);
  const [audience, setAudience] = useState<'all' | 'draw' | 'winners'>('all');
  const [drawFilter, setDrawFilter] = useState('');
  const [sent, setSent]         = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview]   = useState(false);
  const [tplPage, setTplPage] = useState(1);
  const TPL_PAGE_SIZE = 10;
  const paginatedTemplates = templates.slice((tplPage - 1) * TPL_PAGE_SIZE, tplPage * TPL_PAGE_SIZE);

  useEffect(() => { setTplPage(1); }, [templates.length]);

  const toggleChannel = (ch: Channel) =>
    setChannels(p => p.includes(ch) ? p.filter(c => c !== ch) : [...p, ch]);

  const applyTemplate = (t: Template) => {
    setSubject(t.subject);
    setBody(t.body);
    setMsgType(t.type);
    setChannels(t.channels);
  };

  const handleSend = async () => {
    if (!subject || !body || channels.length === 0) return;
    try {
      setSending(true);
      await api(apiUrls.notifications.send, {
        method: 'POST',
        body: JSON.stringify({
          subject,
          body,
          type: msgType,
          audience,
          draw_id: drawFilter || undefined,
        }),
      });
      setSent(true);
      setTimeout(() => setSent(false), 3500);
      setSubject(''); setBody(''); setChannels(['in-app']);
    } catch (err: any) {
      alert(err?.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left: form */}
      <div className="col-span-2 space-y-5">
        <AnimatePresence>
          {sent && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-700 text-sm font-medium"
            >
              Broadcast sent successfully!
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message type */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Message type</label>
          <div className="flex gap-2 flex-wrap">
            {(['announcement', 'reminder', 'winner', 'confirmation'] as MessageType[]).map(t => (
              <button
                key={t}
                onClick={() => setMsgType(t)}
                className={`text-sm px-3 py-1.5 rounded-full border capitalize transition-colors ${
                  msgType === t
                    ? `${typeColors[t]} border-current font-semibold`
                    : 'border-primary/20 text-muted-foreground hover:border-primary/40'
                }`}
              >
                {(() => { const typeIconMap: Record<string, React.ComponentType<any>> = { winner: IconStar, reminder: IconClock, announcement: IconBell, confirmation: IconCheck }; const Ic = typeIconMap[t]; return Ic ? <><Ic size={14} stroke={1.5} /> </> : null; })()} {t}
              </button>
            ))}
          </div>
        </div>

        {/* Audience */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Audience</label>
          <div className="flex gap-2">
            {([
              { value: 'all' as const, label: 'All participants' },
              { value: 'draw' as const, label: 'Draw entrants' },
              { value: 'winners' as const, label: 'Winners only' },
            ]).map(a => (
              <button
                key={a.value}
                onClick={() => setAudience(a.value)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  audience === a.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-primary/20 text-muted-foreground hover:border-primary/40'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
          {audience === 'draw' && (
            <input
              type="text"
              value={drawFilter}
              onChange={e => setDrawFilter(e.target.value)}
              placeholder="Draw name..."
              className="mt-2 w-full bg-background border border-primary/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}
        </div>

        {/* Channels */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Send via</label>
          <div className="flex gap-2">
            {channelStatuses.map(ch => (
              <button
                key={ch.id}
                onClick={() => ch.connected && toggleChannel(ch.id)}
                disabled={!ch.connected}
                className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors ${
                  !ch.connected
                    ? 'opacity-40 cursor-not-allowed border-primary/10 text-muted-foreground'
                    : channels.includes(ch.id)
                    ? `${channelBadgeColors[ch.id]} border-current font-medium`
                    : 'border-primary/20 text-muted-foreground hover:border-primary/40'
                }`}
              >
                <span>{(() => { const chIconMap: Record<string, React.ComponentType<any>> = { 'in-app': IconBell, email: IconMail, sms: IconPhone }; const Ic = chIconMap[ch.id]; return Ic ? <Ic size={14} stroke={1.5} /> : null; })()}</span>{ch.label}
                {!ch.connected && <span className="text-xs">(not set up)</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Subject / Title</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. Draw results published for Spring Giveaway"
            className="w-full bg-background border border-primary/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Body */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message body</label>
            <span className="text-xs text-muted-foreground">Use {'{{variable}}'} for merge tags</span>
          </div>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={8}
            placeholder="Write your message here... Use {{first_name}}, {{draw_name}}, {{prize_description}} etc."
            className="w-full bg-background border border-primary/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none font-mono"
          />
        </div>

        {/* Preview */}
        <AnimatePresence>
          {preview && body && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-card border border-primary/20 rounded-lg p-4 overflow-hidden"
            >
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Preview (merge tags resolved with sample data)</p>
              <p className="text-sm font-semibold text-foreground mb-2">
                {subject.replace('{{first_name}}', 'Alex').replace('{{draw_name}}', 'Sample Draw').replace('{{days_left}}', '3')}
              </p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {body
                  .replace(/{{first_name}}/g, 'Alex')
                  .replace(/{{draw_name}}/g, 'Sample Draw')
                  .replace(/{{prize_description}}/g, '$500 Gift Card')
                  .replace(/{{org_name}}/g, 'Acme Corp')
                  .replace(/{{claim_days}}/g, '14')
                  .replace(/{{entry_id}}/g, 'E-20260501-001')
                  .replace(/{{draw_date}}/g, 'May 20, 2026')
                  .replace(/{{close_date}}/g, 'May 20, 2026')
                  .replace(/{{days_left}}/g, '3')
                  .replace(/{{subject}}/g, 'Important Update')
                  .replace(/{{message_body}}/g, 'Your message here.')
                }
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3">
          <Button
            onClick={() => setPreview(p => !p)}
            variant="outline"
            className="border-primary/20"
            disabled={!body}
          >
            {preview ? 'Hide' : 'Preview'}
          </Button>
          <Button
            onClick={handleSend}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!subject || !body || channels.length === 0 || sending}
          >
            {sending ? 'Sending...' : 'Send Broadcast'}
          </Button>
        </div>
      </div>

      {/* Right: templates */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Message Templates</h3>
        <div className="space-y-3">
          {paginatedTemplates.map(t => (
            <div key={t.id} className="bg-card border border-primary/10 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">{t.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[t.type]}`}>{typeIcons[t.type]}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{t.subject}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {t.channels.map(ch => (
                    <span key={ch} className={`text-xs px-1.5 py-0.5 rounded ${channelBadgeColors[ch]}`}>
                      {(() => { const chLabelMap: Record<string, string> = { 'in-app': 'In-App', email: 'Email', sms: 'SMS' }; return chLabelMap[ch] || ch; })()}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => applyTemplate(t)}
                  className="text-xs text-primary hover:text-primary/80 font-medium"
                >
                  Use →
                </button>
              </div>
            </div>
          ))}
        </div>
        <Pagination page={tplPage} totalItems={templates.length} pageSize={TPL_PAGE_SIZE} onPageChange={setTplPage} />
      </div>
    </div>
  );
}

// ─── History Panel ─────────────────────────────────────────────────────────────

function HistoryPanel() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<MessageType | 'all'>('all');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api<{ success: boolean; data: any[] }>(apiUrls.notifications.list);
        setHistory(
          (res.data || []).map((n: any) => ({
            id: n.id,
            subject: n.title,
            body: n.message,
            type: (n.type || 'announcement') as MessageType,
            channels: ['in-app'] as Channel[],
            sentAt: n.created_at?.split('T')[0] || '',
            recipients: n.data?.recipients || 1,
            opened: n.data?.opened || 0,
            clicked: n.data?.clicked || 0,
            drawName: n.data?.draw_name || undefined,
          }))
        );
      } catch {}
    };
    fetchHistory();
  }, []);

  const filtered = history.filter(h => {
    const matchType = typeFilter === 'all' || h.type === typeFilter;
    const matchSearch = !search || h.subject.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex gap-3 flex-wrap items-center">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search history..."
          className="bg-background border border-primary/20 rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-w-[200px]"
        />
        <div className="flex gap-2">
          {(['all', 'announcement', 'reminder', 'winner', 'confirmation'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                typeFilter === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-primary/20 text-muted-foreground hover:border-primary/40'
              }`}
            >
              {t === 'all' ? 'All' : `${typeIcons[t]} ${t}`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {paginated.map((entry, idx) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            className="bg-card border border-primary/10 rounded-lg p-5"
          >
            <div className="flex items-start gap-4">
                <span className="text-xl mt-1">{(() => { const typeIconMap: Record<string, React.ComponentType<any>> = { winner: IconStar, reminder: IconClock, announcement: IconBell, confirmation: IconCheck }; const Ic = typeIconMap[entry.type]; return Ic ? <Ic size={20} stroke={1.5} /> : null; })()}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <p className="font-semibold text-sm text-foreground">{entry.subject}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${typeColors[entry.type]}`}>{entry.type}</span>
                </div>
                {entry.drawName && (
                  <p className="text-xs text-primary font-medium mb-2">{entry.drawName}</p>
                )}
                <p className="text-xs text-muted-foreground line-clamp-1 mb-3">{entry.body}</p>

                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground font-mono">{entry.sentAt}</span>
                    <div className="flex gap-1">
                      {entry.channels.map(ch => (
                        <span key={ch} className={`text-xs px-1.5 py-0.5 rounded ${channelBadgeColors[ch]}`}>
                          {ch}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Read receipt stats */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      <span className="font-semibold text-foreground">{entry.recipients}</span> sent
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">{pct(entry.opened, entry.recipients)}</span> opened
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">{pct(entry.clicked, entry.recipients)}</span> clicked
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No messages found.</div>
        )}
      </div>
      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel() {
  const [statuses, setStatuses] = useState(channelStatuses);
  const [smtpHost, setSmtpHost] = useState('smtp.sendgrid.net');
  const [smtpKey,  setSmtpKey]  = useState('SG.••••••••••••');
  const [twilioSid, setTwilioSid] = useState('');
  const [twilioToken, setTwilioToken] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-2xl space-y-8">
      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-700 text-sm"
          >
            Settings saved.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <IconMail size={18} stroke={1.5} /> Email (SMTP)
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium">Connected</span>
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">SMTP host</label>
            <input type="text" value={smtpHost} onChange={e => setSmtpHost(e.target.value)}
              className="w-full bg-background border border-primary/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">API key</label>
            <input type="password" value={smtpKey} onChange={e => setSmtpKey(e.target.value)}
              className="w-full bg-background border border-primary/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        </div>
      </div>

      {/* SMS */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <IconPhone size={18} stroke={1.5} /> SMS (Twilio)
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 font-medium">Not configured</span>
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Account SID</label>
            <input type="text" value={twilioSid} onChange={e => setTwilioSid(e.target.value)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full bg-background border border-primary/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Auth token</label>
            <input type="password" value={twilioToken} onChange={e => setTwilioToken(e.target.value)} placeholder="••••••••••••••••"
              className="w-full bg-background border border-primary/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Channel status summary</h3>
        <div className="space-y-2">
          {channelStatuses.map(ch => (
            <div key={ch.id} className={`flex items-center justify-between p-3 rounded-lg border ${
              ch.connected ? 'bg-green-500/5 border-green-500/20' : 'bg-yellow-500/5 border-yellow-500/20'
            }`}>
              <span className="text-sm text-foreground flex items-center gap-2">{(() => { const chIconMap: Record<string, React.ComponentType<any>> = { 'in-app': IconBell, email: IconMail, sms: IconPhone }; const Ic = chIconMap[ch.id]; return Ic ? <Ic size={16} stroke={1.5} /> : null; })()} {ch.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{ch.detail}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  ch.connected ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'
                }`}>
                  {ch.connected ? 'Connected' : 'Not configured'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
        Save settings
      </Button>
    </div>
  );
}

// ─── Template Manager ─────────────────────────────────────────────────────────

function TemplatesPanel({ templates, onUpdate }: { templates: Template[]; onUpdate: (t: Template[]) => void }) {
  const [editing, setEditing] = useState<Template | null>(null);
  const [localTemplates, setLocalTemplates] = useState(templates);
  const [tplPage, setTplPage] = useState(1);
  const TPL_PAGE_SIZE = 10;
  const paginatedTemplates = localTemplates.slice((tplPage - 1) * TPL_PAGE_SIZE, tplPage * TPL_PAGE_SIZE);
  useEffect(() => { setTplPage(1); }, [localTemplates.length]);

  const handleSave = () => {
    if (!editing) return;
    const updated = localTemplates.find(t => t.id === editing.id)
      ? localTemplates.map(t => t.id === editing.id ? editing : t)
      : [...localTemplates, editing];
    setLocalTemplates(updated);
    onUpdate(updated);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    const updated = localTemplates.filter(t => t.id !== id);
    setLocalTemplates(updated);
    onUpdate(updated);
  };

  const newTemplate = (): Template => ({
    id: `t${Date.now()}`,
    name: 'New Template',
    type: 'announcement',
    subject: '',
    body: '',
    channels: ['in-app'],
  });

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Template list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">All templates</h3>
          <Button onClick={() => setEditing(newTemplate())} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
            + New
          </Button>
        </div>
        <div className="space-y-3">
          {paginatedTemplates.map(t => (
            <div
              key={t.id}
              onClick={() => setEditing({ ...t })}
              className={`bg-card border rounded-lg p-4 cursor-pointer transition-colors hover:border-primary/30 ${
                editing?.id === t.id ? 'border-primary/50 bg-primary/5' : 'border-primary/10'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-foreground">{t.name}</span>
                <div className="flex items-center gap-2">
                   <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[t.type]}`}>{(() => { const typeIconMap: Record<string, React.ComponentType<any>> = { winner: IconStar, reminder: IconClock, announcement: IconBell, confirmation: IconCheck }; const Ic = typeIconMap[t.type]; return Ic ? <Ic size={12} stroke={1.5} /> : null; })()}</span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(t.id); }}
                    className="text-xs text-destructive/60 hover:text-destructive"
                  ><IconX size={18} stroke={1.5} /></button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">{t.subject}</p>
              <div className="flex gap-1 mt-2">
                {t.channels.map(ch => (
                  <span key={ch} className={`text-xs px-1.5 py-0.5 rounded ${channelBadgeColors[ch]}`}>
                    {ch}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Pagination page={tplPage} totalItems={localTemplates.length} pageSize={TPL_PAGE_SIZE} onPageChange={setTplPage} />
      </div>

      {/* Editor */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-card border border-primary/20 rounded-lg p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-semibold text-foreground">Edit template</h3>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <input type="text" value={editing.name}
                onChange={e => setEditing(p => p && ({ ...p, name: e.target.value }))}
                className="w-full bg-background border border-primary/20 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Type</label>
              <select value={editing.type}
                onChange={e => setEditing(p => p && ({ ...p, type: e.target.value as MessageType }))}
                className="w-full bg-background border border-primary/20 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
              >
                {(['announcement', 'reminder', 'winner', 'confirmation'] as MessageType[]).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
              <input type="text" value={editing.subject}
                onChange={e => setEditing(p => p && ({ ...p, subject: e.target.value }))}
                className="w-full bg-background border border-primary/20 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Body</label>
              <textarea rows={6} value={editing.body}
                onChange={e => setEditing(p => p && ({ ...p, body: e.target.value }))}
                className="w-full bg-background border border-primary/20 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none font-mono text-foreground" />
            </div>

            <div className="flex gap-3">
              <Button onClick={handleSave} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">Save</Button>
              <Button onClick={() => setEditing(null)} size="sm" variant="outline" className="border-primary/20">Cancel</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CommunicationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('compose');
  const [templates, setTemplates] = useState<Template[]>(mockTemplates);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api<{ success: boolean; data: any[] }>(apiUrls.notifications.list);
        setHistory(
          (res.data || []).map((n: any) => ({
            id: n.id,
            subject: n.title,
            body: n.message,
            type: (n.type || 'announcement') as MessageType,
            channels: ['in-app'] as Channel[],
            sentAt: n.created_at?.split('T')[0] || '',
            recipients: n.data?.recipients || 1,
            opened: n.data?.opened || 0,
            clicked: n.data?.clicked || 0,
            drawName: n.data?.draw_name || undefined,
          }))
        );
      } catch {}
    };
    fetchHistory();
  }, []);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'compose',   label: 'Compose',   icon: 'mail' },
    { id: 'history',   label: 'History',   icon: 'clipboardList' },
    { id: 'templates', label: 'Templates', icon: 'fileText' },
    { id: 'settings',  label: 'Settings',  icon: 'settings' },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl font-bold text-foreground">Communications</h1>
            <p className="text-muted-foreground mt-1">Broadcast messages, manage templates, and track delivery</p>

            {/* Channel status strip */}
            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs text-muted-foreground">Channels:</span>
              {channelStatuses.map(ch => (
                <span key={ch.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  ch.connected ? channelBadgeColors[ch.id] : 'bg-muted text-muted-foreground'
                }`}>
                  {(() => { const chIconMap: Record<string, React.ComponentType<any>> = { 'in-app': IconBell, email: IconMail, sms: IconPhone }; const Ic = chIconMap[ch.id]; return Ic ? <><Ic size={12} stroke={1.5} /> </> : null; })()} {ch.label} — {ch.connected ? 'active' : 'inactive'}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="grid grid-cols-4 gap-4"
          >
            {[
              { label: 'Total sent',    value: history.reduce((a, h) => a + h.recipients, 0) },
              { label: 'Broadcasts',    value: history.length },
              { label: 'Avg open rate', value: history.length ? Math.round(history.reduce((a, h) => a + (h.opened / h.recipients), 0) / history.length * 100) + '%' : '0%' },
              { label: 'Templates',     value: templates.length },
            ].map(s => (
              <div key={s.label} className="bg-card border border-primary/10 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </motion.div>

          {/* Tabs */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
            <div className="flex gap-1 border-b border-primary/10 mb-6">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {(() => { const tabIconMap: Record<string, React.ComponentType<any>> = { mail: IconMail, clipboardList: IconClipboardList, fileText: IconFileText, settings: IconSettings }; const Ic = tabIconMap[tab.icon]; return Ic ? <><Ic size={16} stroke={1.5} /> </> : null; })()} {tab.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
              >
                {activeTab === 'compose'   && <ComposePanel templates={templates} />}
                {activeTab === 'history'   && <HistoryPanel />}
                {activeTab === 'templates' && <TemplatesPanel templates={templates} onUpdate={setTemplates} />}
                {activeTab === 'settings'  && <SettingsPanel />}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </main>
    </div>
  );
}