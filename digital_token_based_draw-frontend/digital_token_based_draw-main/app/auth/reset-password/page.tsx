'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { IconLock, IconCircleCheck, IconCircleX } from '@tabler/icons-react';
import { api, apiUrls, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('No reset token found in the link. Please request a new reset link.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await api<{ success: boolean; message: string }>(
        apiUrls.auth.resetPassword,
        { method: 'POST', body: JSON.stringify({ token, password }) },
        true
      );
      setDone(true);
      setMessage('Your password has been reset. You can now sign in with your new password.');
    } catch (err: any) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Password reset failed. The link may be invalid or expired.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-6">
          {done ? (
            <div className="space-y-6 text-center">
              <div className="flex justify-center mb-4">
                <IconCircleCheck size={40} className="text-green-600" stroke={1.5} />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Password Reset</h1>
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>
              <Button
                onClick={() => router.push('/auth')}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              >
                Go to Login
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-4 text-primary"><IconLock size={40} stroke={1.5} /></div>
                <h1 className="text-2xl font-bold text-foreground">Set a New Password</h1>
                <p className="text-sm text-muted-foreground">
                  Choose a strong password to secure your account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">New Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    className="border-primary/20 bg-background text-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">At least 8 characters</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Confirm New Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(''); }}
                    className="border-primary/20 bg-background text-foreground"
                  />
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/40 text-destructive text-sm p-3 rounded flex items-start gap-2">
                    <IconCircleX size={18} stroke={2} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" disabled={isLoading}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>

              <button
                onClick={() => router.push('/auth')}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                ← Back to Login
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-muted-foreground font-mono text-lg">Loading...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}