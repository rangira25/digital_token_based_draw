'use client';

import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconCheck } from '@tabler/icons-react';

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

  // ── State — seeded from user ────────────────────────────────────────────
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(
    () => user?.twoFactorEnabled ?? false
  );
  const [showSetup, setShowSetup]             = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes]         = useState<string[]>([]);
  const [savedBackupCodes, setSavedBackupCodes] = useState(false);

  // ── QR code — computed once ─────────────────────────────────────────────
  const qrCodeUrl = useMemo(() => {
    return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23fff%22 width=%22200%22 height=%22200%22/%3E%3Crect fill=%22%23000%22 x=%2210%22 y=%2210%22 width=%22180%22 height=%22180%22/%3E%3C/svg%3E';
  }, []);

  if (isLoading || !user) return null;

  // ── Handlers ────────────────────────────────────────────────────────────
  const generateBackupCodes = () => {
    const codes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );
    setBackupCodes(codes);
  };

  const handleEnable2FA = () => {
    generateBackupCodes();
    setShowSetup(true);
  };

  const handleVerify = () => {
    if (verificationCode.length === 6) {
      setTwoFactorEnabled(true);
      setShowSetup(false);
      setVerificationCode('');
      // TODO: call updateUser({ twoFactorEnabled: true }) in AuthContext
    }
  };

  const handle2FAToggle = () => {
    if (twoFactorEnabled) {
      setTwoFactorEnabled(false);
      setBackupCodes([]);
      setSavedBackupCodes(false);
      // TODO: call updateUser({ twoFactorEnabled: false }) in AuthContext
    } else {
      handleEnable2FA();
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 space-y-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Two-Factor Authentication</h1>
          <p className="text-muted-foreground">Enhance your account security with 2FA</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="grid lg:grid-cols-3 gap-8">

          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-6">

            {/* Status Card */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className={`border rounded-lg p-8 space-y-4 ${
                twoFactorEnabled ? 'bg-slate-50 border-slate-300' : 'bg-card border-primary/20'
              }`}>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-foreground">Status</h2>
                  <p className={`font-mono text-sm ${twoFactorEnabled ? 'text-slate-700' : 'text-muted-foreground'}`}>
                    {twoFactorEnabled ? 'ENABLED' : 'DISABLED'}
                  </p>
                </div>
                <div className="text-4xl">{twoFactorEnabled ? 'check' : 'circle'}</div>
              </div>

              <div className={`p-4 rounded border text-sm ${
                twoFactorEnabled
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
              }`}>
                {twoFactorEnabled
                  ? 'Your account is protected with two-factor authentication.'
                  : 'Enable 2FA to add an extra layer of security to your organizer account.'}
              </div>

              {!showSetup && (
                <Button onClick={handle2FAToggle} className={`w-full font-semibold ${
                  twoFactorEnabled
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}>
                  {twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                </Button>
              )}
            </motion.div>

            {/* Setup Guide */}
            {showSetup && !twoFactorEnabled && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-primary/20 rounded-lg p-8 space-y-6">
                <h3 className="text-xl font-bold text-foreground">Setup 2FA</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Step 1: Scan QR Code</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Use an authenticator app to scan this code:
                    </p>
                    <div className="bg-white p-4 rounded w-fit mx-auto">
                      <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                    </div>
                  </div>
                  <div className="border-t border-primary/10 pt-4">
                    <h4 className="font-semibold text-foreground mb-3">Step 2: Verify Code</h4>
                    <div className="flex gap-2">
                      <Input type="text" maxLength={6} placeholder="000000"
                        value={verificationCode}
                        onChange={e => setVerificationCode(e.target.value.replace(/[^\d]/g, ''))}
                        className="border-primary/20 bg-background text-foreground text-center text-lg tracking-widest" />
                      <Button onClick={handleVerify} disabled={verificationCode.length !== 6}
                        className="bg-slate-800 text-white hover:bg-slate-700">
                        Verify
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Backup Codes */}
            {backupCodes.length > 0 && !savedBackupCodes && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-8 space-y-4">
                <h3 className="text-xl font-bold text-yellow-400">Save Backup Codes</h3>
                <p className="text-sm text-muted-foreground">
                  Store these somewhere safe — you'll need them if you lose your authenticator.
                </p>
                <div className="grid grid-cols-2 gap-2 bg-black/30 p-4 rounded font-mono text-sm text-foreground">
                  {backupCodes.map((code, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">{idx + 1}.</span>
                      <span>{code}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={() => setSavedBackupCodes(true)}
                  className="w-full bg-slate-800 text-white hover:bg-slate-700">
                  I Have Saved The Codes
                </Button>
              </motion.div>
            )}
          </div>

          {/* Info Sidebar */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }} className="space-y-6">
            <div className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
              <h3 className="font-bold text-foreground">Why 2FA?</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  'Prevents unauthorized access even if password is compromised',
                  'Required for all organizer-level operations',
                  'Industry standard for secure draw management',
                ].map(item => (
                  <li key={item} className="flex gap-2">
                    <span className="text-slate-700"><IconCheck size={16} stroke={2} /></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
              <h3 className="font-bold text-foreground">Supported Apps</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {['Google Authenticator', 'Microsoft Authenticator', 'Authy', '1Password', 'LastPass Authenticator'].map(app => (
                  <li key={app}>• {app}</li>
                ))}
              </ul>
            </div>

            <div className="bg-primary/10 border border-primary/30 rounded-lg p-6 space-y-4">
              <h3 className="font-bold text-primary">Need Help?</h3>
              <p className="text-sm text-muted-foreground">
                Contact support if you're having trouble setting up 2FA.
              </p>
              <Button variant="outline" className="w-full">Contact Support</Button>
            </div>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}