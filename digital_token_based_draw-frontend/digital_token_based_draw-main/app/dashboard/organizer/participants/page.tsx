'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, apiUrls } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { IconSearch, IconUser, IconCheck, IconX, IconMail, IconPhone, IconCalendar } from '@tabler/icons-react';
import { Pagination } from '@/components/Pagination';

interface Participant {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  status: string;
  email_verified: boolean;
  identity_verified: boolean;
  created_at: string;
  last_login_at: string;
}

export default function ParticipantsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (!isLoading && (!user || (user.role !== 'organizer' && user.role !== 'admin'))) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

  const fetchParticipants = useCallback(async () => {
    try {
      const res = await api<{ success: boolean; data: Participant[] }>(
        `${apiUrls.admin.users}?role=participant`
      );
      setParticipants(res.data || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load participants' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchParticipants();
  }, [user, fetchParticipants]);

  const filtered = participants.filter(p => {
    const matchSearch = !searchTerm ||
      p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterStatus]);

  const stats = {
    total: participants.length,
    active: participants.filter(p => p.status === 'active').length,
    verified: participants.filter(p => p.email_verified).length,
    pending: participants.filter(p => p.status === 'pending').length,
  };

  if (isLoading || loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <p className="text-muted-foreground font-mono">Loading participants...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">Participants</h1>
            <p className="text-muted-foreground">Manage and view all registered participants</p>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Participants', value: stats.total },
              { label: 'Active', value: stats.active },
              { label: 'Email Verified', value: stats.verified },
              { label: 'Pending', value: stats.pending },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card border border-primary/20 rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase">{s.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 border-primary/20 bg-background"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'active', 'pending', 'suspended'].map(status => (
                <Button
                  key={status}
                  size="sm"
                  variant={filterStatus === status ? 'default' : 'outline'}
                  onClick={() => setFilterStatus(status)}
                  className={filterStatus === status ? 'bg-slate-800 text-white' : ''}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-primary/20 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-primary/20 bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Participant</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Verified</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      No participants found
                    </td>
                  </tr>
                ) : (
                  paginated.map(p => (
                    <tr key={p.id} className="border-b border-primary/10 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <IconUser size={16} className="text-muted-foreground" />
                          </div>
                          <span className="text-sm font-medium text-foreground">{p.full_name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{p.email}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{p.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          p.status === 'active' ? 'bg-green-500/10 text-green-700' :
                          p.status === 'pending' ? 'bg-yellow-500/10 text-yellow-700' :
                          'bg-red-500/10 text-red-700'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.email_verified ? (
                          <IconCheck size={16} className="text-green-600" />
                        ) : (
                          <IconX size={16} className="text-red-400" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </div>
      </main>
    </div>
  );
}
