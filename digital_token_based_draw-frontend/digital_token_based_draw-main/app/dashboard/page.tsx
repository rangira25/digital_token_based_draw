'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardRouter() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/auth');
      } else {
        // Route to appropriate dashboard based on role
        const path = user.role === 'organizer' ? '/dashboard/organizer' : '/dashboard/participant';
        router.push(path);
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-slate-600 font-mono text-2xl mb-4">Loading...</div>
        <p className="text-muted-foreground">Initializing dashboard</p>
      </div>
    </div>
  );
}
