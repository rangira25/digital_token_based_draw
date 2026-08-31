'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { IconLoader2, IconCircleCheck, IconCircleX } from '@tabler/icons-react';
import { api, apiUrls, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';

type Status = 'verifying' | 'success' | 'error';

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the link.');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await api<{ success: boolean; message: string }>(
          apiUrls.auth.verifyEmail,
          { method: 'POST', body: JSON.stringify({ token }) },
          true // skipAuth — user isn't logged in yet
        );
        if (!cancelled) {
          setStatus('success');
          setMessage('Your email has been verified. You can now log in.');
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setMessage(
            err instanceof ApiError
              ? err.message
              : 'Verification failed. The link may be invalid or expired.'
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-6 text-center">
          <div className="flex justify-center mb-4">
            {status === 'verifying' && <IconLoader2 size={40} className="animate-spin text-muted-foreground" stroke={1.5} />}
            {status === 'success' && <IconCircleCheck size={40} className="text-green-600" stroke={1.5} />}
            {status === 'error' && <IconCircleX size={40} className="text-destructive" stroke={1.5} />}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              {status === 'verifying' && 'Verifying your email...'}
              {status === 'success' && 'Email Verified'}
              {status === 'error' && 'Verification Failed'}
            </h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>

          {status !== 'verifying' && (
            <Button
              onClick={() => router.push('/auth')}
              className="w-full bg-slate-900 text-white hover:bg-slate-800"
            >
              Go to Login
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-slate-700 font-mono text-lg">Loading...</div>
      </div>
    }>
      <VerifyForm />
    </Suspense>
  );
}