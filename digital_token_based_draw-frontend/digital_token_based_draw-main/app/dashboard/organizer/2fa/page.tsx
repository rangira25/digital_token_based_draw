'use client';

import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconCheck, IconShieldLock, IconMail, IconClock } from '@tabler/icons-react';

export default function TwoFactorPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // ── Auth guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    if (!user || (user.role !== 'organizer' && user.role !== 'admin')) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

  const [maskedEmail] = useState(() => {
    const email = user?.email ?? '';
    return email.replace(/(.{2}).+(@.+)/, '$1***$2');
  });

  if (isLoading || !user) return null;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 space-y-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Two-Factor Authentication</h1>
          <p className="text-muted-foreground">Email-code 2FA is required for all organizer and admin accounts</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="grid lg:grid-cols-3 gap-8">

          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="border rounded-lg p-8 space-y-4 bg-card border-primary/20">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-foreground">Status</h2>
                  <p className="text-sm text-green-600 font-semibold">ENABLED</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                  <IconShieldLock size={26} stroke={1.5} />
                </div>
              </div>

              <div className="p-4 rounded border text-sm bg-green-500/10 border-green-500/30 text-green-600">
                Your account is protected with email-based two-factor authentication.
                A new 6-digit code is sent to your inbox every time you sign in.
              </div>

              <Button disabled className="w-full font-semibold bg-primary/10 text-primary border border-primary/30 cursor-not-allowed">
                Always Enabled — Cannot be Disabled
              </Button>
            </motion.div>

            {/* How it works */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-primary/20 rounded-lg p-8 space-y-6">
              <h3 className="text-xl font-bold text-foreground">How It Works</h3>
              <div className="space-y-5">
                {[
                  { icon: IconMail, title: '1. Sign in with your password', desc: `A 6-digit verification code is emailed to ${maskedEmail} (the address you registered with).` },
                  { icon: IconClock, title: '2. Enter the code within 10 minutes', desc: 'The code expires after 10 minutes. You can request a new one from the 2FA screen if needed.' },
                  { icon: IconCheck, title: '3. You\'re signed in securely', desc: 'The code is single-use and can only be verified once. This applies to every organizer and admin sign-in.' },
                ].map(step => {
                  const Ic = step.icon;
                  return (
                    <div key={step.title} className="flex gap-4">
                      <span className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Ic size={20} stroke={1.5} />
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">{step.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>

          {/* Info Sidebar */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }} className="space-y-6">
            <div className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
              <h3 className="font-bold text-foreground">Why 2FA?</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  'Prevents unauthorized access even if your password is compromised',
                  'Required for organizer and admin sign-ins',
                  'Industry standard for secure draw management',
                ].map(item => (
                  <li key={item} className="flex gap-2">
                    <span className="text-green-600"><IconCheck size={16} stroke={2} /></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-primary/10 border border-primary/30 rounded-lg p-6 space-y-4">
              <h3 className="font-bold text-primary">Need Help?</h3>
              <p className="text-sm text-muted-foreground">
                If you aren't receiving your code, check your spam folder or contact support.
              </p>
              <Button variant="outline" className="w-full">Contact Support</Button>
            </div>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}