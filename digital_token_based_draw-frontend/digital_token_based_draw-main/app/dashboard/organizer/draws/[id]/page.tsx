'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { Button } from '@/components/ui/button';
import { api, apiUrls } from '@/lib/api';
import { IconArrowLeft, IconPlayerPlay, IconPlayerStop, IconCheck } from '@tabler/icons-react';

interface DrawDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  organizer_name: string;
  entry_count: number;
  registration_start: string;
  registration_end: string;
  draw_date: string;
  max_participants: number;
  max_entries_per_user: number;
  winners_count: number;
  tokens_per_entry: number;
  is_public: boolean;
  prizes: { rank: number; title: string; description: string; prize_type: string; value: number; quantity: number }[];
  created_at: string;
}

export default function DrawDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [draw, setDraw] = useState<DrawDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user || (user.role !== 'organizer' && user.role !== 'admin')) {
      router.push('/auth');
      return;
    }
    const fetchDraw = async () => {
      try {
        const res = await api<{ success: boolean; data: DrawDetail }>(apiUrls.draws.get(id));
        setDraw(res.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load draw');
      } finally {
        setLoading(false);
      }
    };
    fetchDraw();
  }, [id, user, isLoading, router]);

  const handleStatusChange = async (newStatus: string) => {
    if (!draw) return;
    setUpdating(true);
    setError('');
    try {
      await api(apiUrls.draws.updateStatus(draw.id), {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setDraw(prev => prev ? { ...prev, status: newStatus } : prev);
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const statusColor = (s: string) => {
    if (s === 'open') return 'bg-slate-800 text-white';
    if (s === 'completed') return 'bg-primary/20 text-primary';
    if (s === 'draft') return 'bg-muted text-muted-foreground';
    if (s === 'closed') return 'bg-yellow-500/20 text-yellow-600';
    return 'bg-muted text-muted-foreground';
  };

  const nextStatus = (s: string) => {
    if (s === 'draft') return 'open';
    if (s === 'open') return 'closed';
    if (s === 'closed') return 'completed';
    return null;
  };

  const nextStatusLabel = (s: string) => {
    if (s === 'draft') return 'Publish (Open)';
    if (s === 'open') return 'Close Entries';
    if (s === 'closed') return 'Mark Completed';
    return null;
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <p className="text-muted-foreground">Loading draw details...</p>
        </main>
      </div>
    );
  }

  if (error && !draw) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-64 flex flex-col items-center justify-center gap-4">
          <p className="text-red-400">{error}</p>
          <Button onClick={() => router.push('/dashboard/organizer/draws')} variant="outline" className="border-primary/20">
            <IconArrowLeft size={16} className="mr-2" /> Back to Draws
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 max-w-4xl">
          {/* Header */}
          <div className="mb-6">
            <button onClick={() => router.push('/dashboard/organizer/draws')}
              className="text-sm text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1">
              <IconArrowLeft size={14} /> Back to Draws
            </button>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{draw?.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">{draw?.description}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColor(draw?.status || 'draft')}`}>
                {(draw?.status || 'draft').charAt(0).toUpperCase() + (draw?.status || 'draft').slice(1)}
              </span>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 mb-4">
              {error}
            </div>
          )}

          {/* Info Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Entries', value: draw?.entry_count || 0 },
              { label: 'Max Participants', value: draw?.max_participants || 'Unlimited' },
              { label: 'Winners', value: draw?.winners_count || 1 },
              { label: 'Tokens/Entry', value: draw?.tokens_per_entry || 1 },
            ].map(card => (
              <div key={card.label} className="bg-card border border-primary/20 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                <p className="text-xl font-bold text-foreground">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Dates */}
          <div className="bg-card border border-primary/20 rounded-lg p-6 mb-8">
            <h2 className="text-sm font-semibold text-foreground mb-4">Timeline</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Registration Start</p>
                <p className="text-foreground font-mono">{draw?.registration_start ? new Date(draw.registration_start).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Registration End</p>
                <p className="text-foreground font-mono">{draw?.registration_end ? new Date(draw.registration_end).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Draw Date</p>
                <p className="text-foreground font-mono">{draw?.draw_date ? new Date(draw.draw_date).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Prizes */}
          {draw?.prizes && draw.prizes.length > 0 && (
            <div className="bg-card border border-primary/20 rounded-lg p-6 mb-8">
              <h2 className="text-sm font-semibold text-foreground mb-4">Prizes</h2>
              <div className="space-y-3">
                {draw.prizes.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-background border border-primary/10 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-primary">#{p.rank}</span>
                      <div>
                        <p className="text-sm text-foreground font-medium">{p.title}</p>
                        {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">${p.value}</p>
                      <p className="text-xs text-muted-foreground">Qty: {p.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="bg-card border border-primary/20 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">Actions</h2>
            <div className="flex gap-3">
              {nextStatus(draw?.status || 'draft') && (
                <Button
                  onClick={() => handleStatusChange(nextStatus(draw!.status)!)}
                  disabled={updating}
                  className="bg-slate-800 text-white hover:bg-slate-700"
                >
                  {draw?.status === 'draft' && <IconPlayerPlay size={16} className="mr-2" />}
                  {draw?.status === 'open' && <IconPlayerStop size={16} className="mr-2" />}
                  {draw?.status === 'closed' && <IconCheck size={16} className="mr-2" />}
                  {nextStatusLabel(draw?.status || 'draft')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
