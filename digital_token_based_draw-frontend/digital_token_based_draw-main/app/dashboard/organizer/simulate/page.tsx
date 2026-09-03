'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, apiUrls } from '@/lib/api';
import {
  IconDiamond, IconUsers, IconTrophy, IconPlayerPlay,
  IconCopy, IconCheck, IconSearch, IconChevronRight,
  IconSpeakerphone, IconTicket,
} from '@tabler/icons-react';

interface Draw {
  id: string;
  title: string;
  status: string;
  description: string;
  winnersCount: number;
  registrationEnd: string;
  drawDate: string;
  organizer: string;
  totalEntries: number;
}

interface Entry {
  id: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  tokenCode: string;
  submittedAt: string;
  weight: number;
}

interface Winner {
  id: string;
  participantId: string;
  participantName: string;
  rank: number;
  prize: string;
  prizeValue: number;
  verificationCode: string;
  claimDeadline: string;
}

interface SimResult {
  winners: Winner[];
  losers: { id: string; name: string }[];
  seed: string;
  drawTitle: string;
  notificationsSent: number;
}

export default function OrganizerSimulatePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [draws, setDraws] = useState<Draw[]>([]);
  const [selectedDraw, setSelectedDraw] = useState<Draw | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadingDraws, setLoadingDraws] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const [simulating, setSimulating] = useState(false);
  const [spinPhase, setSpinPhase] = useState<'idle' | 'spinning' | 'revealing' | 'done'>('idle');
  const [currentSpinName, setCurrentSpinName] = useState('');
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState('');

  const [notifySubject, setNotifySubject] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [sendingNotify, setSendingNotify] = useState(false);
  const [notifySent, setNotifySent] = useState(false);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user || (user.role !== 'organizer' && user.role !== 'admin')) { router.push('/auth'); return; }
    (async () => {
      try {
        const res = await api<{ success: boolean; data: any[] }>(apiUrls.draws.list);
        const mapped: Draw[] = (res.data || []).map((d: any) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          description: d.description || '',
          winnersCount: d.winners_count || 1,
          registrationEnd: d.registration_end?.split('T')[0] || '',
          drawDate: d.draw_date?.split('T')[0] || '',
          organizer: d.organizer?.name || 'Unknown',
          totalEntries: d.total_entries || 0,
        }));
        setDraws(mapped);
      } catch { setDraws([]); }
      setLoadingDraws(false);
    })();
  }, [user, isLoading, router]);

  const selectDraw = async (draw: Draw) => {
    setSelectedDraw(draw);
    setEntries([]);
    setResult(null);
    setSpinPhase('idle');
    setError('');
    setNotifySent(false);
    setNotifySubject('');
    setNotifyBody('');
    if (draw.status === 'completed') {
      try {
        const res = await api<{ success: boolean; data: any[] }>(apiUrls.draws.winners(draw.id));
        const mapped: Winner[] = (res.data || []).map((w: any) => ({
          id: w.id,
          participantId: w.participant_id,
          participantName: w.participant?.name || w.participant_name || 'Unknown',
          rank: w.rank || 1,
          prize: w.prize?.title || 'Prize',
          prizeValue: w.prize?.value || 0,
          verificationCode: w.verification_code || '',
          claimDeadline: w.claim_deadline?.split('T')[0] || '',
        }));
        setResult({ winners: mapped, losers: [], seed: '', drawTitle: draw.title, notificationsSent: 0 });
        setSpinPhase('done');
      } catch { /* no existing results */ }
      return;
    }
    setLoadingEntries(true);
    try {
      const res = await api<{ success: boolean; data: any[] }>(apiUrls.tokens.drawTokens(draw.id));
      const mapped: Entry[] = (res.data || []).map((t: any) => ({
        id: t.id,
        participantId: t.participant_id,
        participantName: t.participant_name || t.participant?.name || 'Unknown',
        participantEmail: t.participant_email || t.participant?.email || '',
        tokenCode: t.token_code,
        submittedAt: t.issued_at?.split('T')[0] || '',
        weight: t.weight || 1,
      }));
      setEntries(mapped);
    } catch { setEntries([]); }
    setLoadingEntries(false);
  };

  const executeBackend = async () => {
    if (!selectedDraw) return;
    try {
      const res = await api<{ success: boolean; data: any; message?: string }>(
        apiUrls.draws.execute(selectedDraw.id),
        { method: 'POST' }
      );
      const w = res.data.winners || [];
      const winners: Winner[] = w.map((x: any) => ({
        id: x.id,
        participantId: x.participant_id,
        participantName: entries.find(e => e.participantId === x.participant_id)?.participantName || 'Unknown',
        rank: x.rank || 1,
        prize: x.prize?.title || 'Prize',
        prizeValue: x.prize?.value || 0,
        verificationCode: x.verification_code || '',
        claimDeadline: x.claim_deadline?.split('T')[0] || '',
      }));
      const winnerIds = new Set(winners.map(w => w.participantId));
      const losers = entries
        .filter(e => !winnerIds.has(e.participantId))
        .map(e => ({ id: e.participantId, name: e.participantName }));

      setCurrentSpinName(winners[0]?.participantName || 'Winner');

      setTimeout(() => {
        setSpinPhase('revealing');
        setTimeout(() => {
          setResult({
            winners,
            losers,
            seed: res.data.seed || '',
            drawTitle: selectedDraw.title,
            notificationsSent: winners.length + losers.length,
          });
          setSpinPhase('done');
          setSimulating(false);
          setDraws(prev => prev.map(d => d.id === selectedDraw.id ? { ...d, status: 'completed' } : d));
        }, 1500);
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Failed to execute draw');
      setSpinPhase('idle');
      setSimulating(false);
    }
  };

  const startSpin = useCallback(() => {
    if (!entries.length) return;
    setSimulating(true);
    setSpinPhase('spinning');
    setResult(null);
    setError('');

    const pool: string[] = [];
    for (const e of entries) {
      for (let w = 0; w < e.weight; w++) {
        pool.push(e.participantName);
      }
    }

    let tick = 0;
    const totalTicks = 60 + Math.floor(Math.random() * 20);
    let interval = 50;

    const spin = () => {
      const idx = tick % pool.length;
      setCurrentSpinName(pool[idx]);
      tick++;

      if (tick >= totalTicks) {
        executeBackend();
        return;
      }

      const progress = tick / totalTicks;
      interval = 50 + Math.floor(progress * progress * 400);
      spinTimerRef.current = setTimeout(spin, interval);
    };

    spin();
  }, [entries, selectedDraw]);

  useEffect(() => {
    return () => { if (spinTimerRef.current) clearTimeout(spinTimerRef.current); };
  }, []);

  const handleSendNotify = async () => {
    if (!selectedDraw || !notifySubject || !notifyBody) return;
    setSendingNotify(true);
    try {
      await api(apiUrls.notifications.send, {
        method: 'POST',
        body: JSON.stringify({
          subject: notifySubject,
          body: notifyBody,
          type: 'announcement',
          audience: 'draw',
          draw_id: selectedDraw.id,
        }),
      });
      setNotifySent(true);
      setNotifySubject('');
      setNotifyBody('');
    } catch { /* ignore */ }
    setSendingNotify(false);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (isLoading || loadingDraws) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <p className="text-muted-foreground">Loading draws...</p>
        </main>
      </div>
    );
  }

  const canExecute = (d: Draw) => d.status === 'closed';
  const isDone = spinPhase === 'done';

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="relative p-8 space-y-8 max-w-7xl mx-auto">

          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl font-bold text-foreground">Simulate Draw</h1>
            <p className="text-muted-foreground mt-1">Pick a draw, watch the random selection, and send notifications to participants.</p>
          </motion.div>

          {/* Raffle video hero panel */}
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            className="relative h-[42vh] min-h-[300px] overflow-hidden rounded-2xl border border-border shadow-lg">
            <video
              src="/roulette-wheel.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
              <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white text-[11px] font-semibold uppercase tracking-widest mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                Live Raffle
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-white drop-shadow">
                {selectedDraw ? selectedDraw.title : 'Random Draw Simulation'}
              </h2>
              <p className="text-white/80 mt-2 max-w-xl">
                {selectedDraw
                  ? `${selectedDraw.totalEntries} entries in the pool · ${selectedDraw.winnersCount} winner${selectedDraw.winnersCount !== 1 ? 's' : ''}`
                  : 'Select a draw to begin the live random selection experience'}
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-[11px] font-mono text-white/70 bg-black/30 rounded-full px-4 py-1.5 backdrop-blur">
                <IconDiamond size={14} /> Raffall · Casino luck wheel
              </span>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left: Draw List */}
            <div className="lg:col-span-1 space-y-3">
              <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Select a Draw</h2>
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {draws.map(draw => {
                  const ready = canExecute(draw);
                  const done = draw.status === 'completed';
                  const active = selectedDraw?.id === draw.id;
                  return (
                    <motion.button key={draw.id} onClick={() => selectDraw(draw)}
                      whileHover={{ x: 2 }}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : ready
                            ? 'bg-card border-green-500/30 hover:border-green-500/60'
                            : done
                              ? 'bg-card border-primary/20 opacity-70'
                              : 'bg-card border-primary/20 opacity-50'
                      }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{draw.title}</p>
                          <p className="text-xs opacity-70 mt-0.5">{draw.totalEntries} entries</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {ready && <span className="text-xs font-mono bg-green-500/20 text-green-600 px-2 py-0.5 rounded">READY</span>}
                          {done && <span className="text-xs font-mono bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded">DONE</span>}
                          {!ready && !done && <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded">{draw.status.toUpperCase()}</span>}
                          <IconChevronRight size={14} className="opacity-40" />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
                {draws.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No draws found.</p>
                )}
              </div>
            </div>

            {/* Right: Simulator */}
            <div className="lg:col-span-2 space-y-6">
              {!selectedDraw ? (
                <div className="flex flex-col items-center justify-center h-96 bg-card border border-primary/20 rounded-lg text-center">
                  <IconDiamond size={64} className="text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground text-lg">Select a draw to begin simulation</p>
                  <p className="text-muted-foreground text-sm mt-1">Only draws with status &quot;closed&quot; can be executed</p>
                </div>
              ) : (
                <>
                  {/* Draw Info Bar */}
                  <div className="bg-card border border-primary/20 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-foreground">{selectedDraw.title}</h3>
                      <p className="text-sm text-muted-foreground">{selectedDraw.description}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <span className={`text-xs font-mono px-2 py-1 rounded border ${
                        selectedDraw.status === 'closed'
                          ? 'bg-green-500/10 text-green-600 border-green-500/30'
                          : selectedDraw.status === 'completed'
                            ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                            : 'bg-muted text-muted-foreground border-primary/20'
                      }`}>
                        {selectedDraw.status.toUpperCase()}
                      </span>
                      <p className="text-xs text-muted-foreground">{selectedDraw.winnersCount} winner(s)</p>
                    </div>
                  </div>

                  {/* Spin / Reveal Area */}
                  <div className="relative bg-gradient-to-br from-card to-card/50 border border-primary/30 rounded-lg overflow-hidden">
                    <div className="absolute inset-0 opacity-10"
                      style={{ backgroundImage: 'radial-gradient(circle, #3BB82E 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                    <div className="relative p-8 flex flex-col items-center justify-center min-h-[320px]">
                      <AnimatePresence mode="wait">
                        {spinPhase === 'idle' && !isDone && (
                          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="text-center space-y-4 w-full">
                            {entries.length > 0 ? (
                              <>
                                <IconUsers size={48} className="mx-auto text-muted-foreground/30 mb-2" />
                                <p className="text-sm text-muted-foreground">
                                  {entries.length} participant{entries.length !== 1 ? 's' : ''} in the pool
                                </p>
                                <div className="flex flex-wrap gap-2 justify-center max-h-32 overflow-y-auto">
                                  {entries.map(e => (
                                    <span key={e.id} className="text-xs bg-background border border-primary/20 rounded px-2 py-1 text-foreground font-mono">
                                      {e.participantName}
                                      {e.weight > 1 && <span className="ml-1 text-primary">x{e.weight}</span>}
                                    </span>
                                  ))}
                                </div>
                                {canExecute(selectedDraw) && (
                                  <Button onClick={startSpin} disabled={simulating}
                                    className="bg-[#3BB82E] text-white hover:bg-[#288C1D] mt-4">
                                    <IconPlayerPlay size={16} className="mr-2" />
                                    Simulate Draw
                                  </Button>
                                )}
                                {!canExecute(selectedDraw) && selectedDraw.status !== 'completed' && (
                                  <p className="text-xs text-muted-foreground mt-4">
                                    Draw must be &quot;closed&quot; before it can be executed.
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-muted-foreground">No entries found for this draw.</p>
                            )}
                          </motion.div>
                        )}

                        {spinPhase === 'spinning' && (
                          <motion.div key="spinning" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                            className="text-center space-y-6">
                            <motion.div
                              key={currentSpinName}
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              className="text-5xl font-bold text-foreground font-mono tracking-tight">
                              {currentSpinName}
                            </motion.div>
                            <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
                              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.5, ease: 'linear' }}>
                                <IconTicket size={16} />
                              </motion.div>
                              <span>Selecting winner...</span>
                            </div>
                            {Array.from({ length: 20 }).map((_, i) => (
                              <motion.div key={i}
                                className="absolute w-1 h-1 bg-primary/30 rounded-full"
                                initial={{ x: 0, y: 0, opacity: 1 }}
                                animate={{
                                  x: (Math.random() - 0.5) * 400,
                                  y: (Math.random() - 0.5) * 300,
                                  opacity: 0,
                                }}
                                transition={{ duration: 1.5, delay: i * 0.05, repeat: Infinity }}
                                style={{ left: '50%', top: '50%' }}
                              />
                            ))}
                          </motion.div>
                        )}

                        {spinPhase === 'revealing' && (
                          <motion.div key="revealing" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="text-center space-y-4">
                            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>
                              <IconTrophy size={64} className="mx-auto text-yellow-500" />
                            </motion.div>
                            <p className="text-4xl font-bold text-foreground">{currentSpinName}</p>
                            <p className="text-lg text-green-600 font-semibold">WINNER!</p>
                            {Array.from({ length: 30 }).map((_, i) => (
                              <motion.div key={i}
                                className="absolute w-2 h-2 rounded-full"
                                style={{ background: ['#374151', '#22c55e', '#eab308', '#3b82f6', '#ef4444'][i % 5], left: '50%', top: '40%' }}
                                initial={{ x: 0, y: 0, opacity: 1 }}
                                animate={{
                                  x: (Math.random() - 0.5) * 500,
                                  y: -200 - Math.random() * 300,
                                  opacity: 0,
                                  rotate: Math.random() * 720,
                                }}
                                transition={{ duration: 2, delay: i * 0.03 }}
                              />
                            ))}
                          </motion.div>
                        )}

                        {spinPhase === 'done' && result && (
                          <motion.div key="done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="w-full space-y-6">
                            <div>
                              <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                <IconTrophy size={14} /> Winner{result.winners.length !== 1 ? 's' : ''}
                              </h3>
                              <div className="space-y-2">
                                {result.winners.map(w => (
                                  <motion.div key={w.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                    className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <span className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">
                                        #{w.rank}
                                      </span>
                                      <div>
                                        <p className="font-semibold text-foreground">{w.participantName}</p>
                                        <p className="text-xs text-muted-foreground">{w.prize} {w.prizeValue ? `($${w.prizeValue})` : ''}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {w.verificationCode && (
                                        <button onClick={() => handleCopy(w.verificationCode)}
                                          className="flex items-center gap-1 text-xs font-mono bg-background border border-primary/20 rounded px-2 py-1 hover:border-primary/40">
                                          {w.verificationCode}
                                          {copiedCode === w.verificationCode
                                            ? <IconCheck size={12} className="text-green-500" />
                                            : <IconCopy size={12} className="text-muted-foreground" />}
                                        </button>
                                      )}
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </div>

                            {result.losers.length > 0 && (
                              <div className="bg-card border border-primary/20 rounded-lg p-4">
                                <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-2">
                                  Notifications Sent ({result.winners.length + result.losers.length} total)
                                </p>
                                <p className="text-sm text-foreground">
                                  <span className="text-green-600 font-semibold">{result.winners.length} winner(s)</span> notified with prize claim details.
                                </p>
                                <p className="text-sm text-foreground mt-1">
                                  <span className="text-muted-foreground">{result.losers.length} participant(s)</span> notified with &quot;better luck next time&quot; message.
                                </p>
                                {result.seed && (
                                  <p className="text-xs text-muted-foreground font-mono mt-2">Seed: {result.seed.slice(0, 16)}...</p>
                                )}
                              </div>
                            )}

                            {result.winners.length > 0 && result.losers.length === 0 && !result.seed && (
                              <div className="bg-card border border-primary/20 rounded-lg p-4">
                                <p className="text-sm text-muted-foreground">
                                  This draw was already executed. Showing existing results.
                                </p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {error && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="absolute bottom-4 left-4 right-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 text-center">
                          {error}
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Send Custom Notification */}
                  {isDone && result && result.losers.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-primary/20 rounded-lg p-5 space-y-4">
                      <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <IconSpeakerphone size={14} /> Send Custom Notification
                      </h3>
                      {notifySent ? (
                        <div className="flex items-center gap-2 text-green-600 text-sm">
                          <IconCheck size={16} /> Notification sent to all {result.winners.length + result.losers.length} participants.
                        </div>
                      ) : (
                        <>
                          <Input placeholder="Subject" value={notifySubject} onChange={e => setNotifySubject(e.target.value)}
                            className="border-primary/20 bg-background text-foreground" />
                          <Input placeholder="Message body" value={notifyBody} onChange={e => setNotifyBody(e.target.value)}
                            className="border-primary/20 bg-background text-foreground" />
                          <Button onClick={handleSendNotify} disabled={!notifySubject || !notifyBody || sendingNotify}
                            className="bg-[#3BB82E] text-white hover:bg-[#288C1D]">
                            <IconSpeakerphone size={14} className="mr-2" />
                            {sendingNotify ? 'Sending...' : `Send to ${result.winners.length + result.losers.length} participants`}
                          </Button>
                        </>
                      )}
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
