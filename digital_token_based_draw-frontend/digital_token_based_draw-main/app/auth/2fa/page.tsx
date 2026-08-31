'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import ReCAPTCHA from 'react-google-recaptcha';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { IconShieldLock } from '@tabler/icons-react';

export default function TwoFactorVerifyPage() {
  const router = useRouter();
  const { pendingUser, user, verify2FA, logout, isLoading: authLoading } = useAuth();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [recaptchaToken, setRecaptchaToken] = useState('');

  // Guard: no pending user means they shouldn't be here
  useEffect(() => {
  if (authLoading) return;
  // Only redirect to /auth if there's no pending session AND no active session
  if (!pendingUser && !user) {
    router.replace('/auth');
  }
}, [pendingUser, user, authLoading, router]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError('');
    // Auto-advance
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    // Auto-submit when all 6 filled
    if (value && index === 5 && newCode.every(d => d)) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(''));
      handleVerify(pasted);
    }
  };

  const handleVerify = async (codeStr?: string) => {
  const fullCode = codeStr ?? code.join('');
  if (fullCode.length !== 6) { setError('Enter all 6 digits'); return; }
  if (!recaptchaToken) { setError('Please complete the reCAPTCHA verification'); return; }

  // Capture role BEFORE verify2FA clears pendingUser
  const role = pendingUser?.role;

  setIsLoading(true);
  setError('');
  try {
    await verify2FA(fullCode, recaptchaToken); // pendingUser becomes null here
    
    // role is already captured safely above
    if (role === 'admin') {
      router.replace('/dashboard/organizer/admin');
    } else if (role === 'organizer') {
      router.replace('/dashboard/organizer');
    } else {
      router.replace('/dashboard'); // fallback
    }
  } catch (err: any) {
    setAttempts(a => a + 1);
    setError(err.message || 'Invalid code');
    setCode(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  } finally {
    setIsLoading(false);
  }
};

  const handleResend = async () => {
    setResendCooldown(60);
    setError('');
    setCode(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
    // In real app: trigger new code send
    console.log('[Mock] New 2FA code sent');
  };

  const handleCancel = () => {
    logout();
    router.push('/auth');
  };

  if (authLoading || !pendingUser) return null;

  const maskedEmail = pendingUser.email.replace(/(.{2}).+(@.+)/, '$1***$2');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4 text-primary"><IconShieldLock size={48} stroke={1.5} /></div>
            <h1 className="text-2xl font-bold text-foreground">Two-Factor Verification</h1>
            <p className="text-sm text-muted-foreground">
              A 6-digit code was sent to
            </p>
            <p className="font-mono text-sm text-primary font-semibold">{maskedEmail}</p>
          </div>

          {/* Role badge */}
          <div className="flex justify-center">
            <span className="bg-primary/10 text-primary border border-primary/30 text-xs font-semibold px-3 py-1 rounded-full capitalize">
              {pendingUser.role} Account
            </span>
          </div>

          {/* Code Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground text-center block">
              Enter verification code
            </label>
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  autoFocus={i === 0}
                  className={`w-11 h-14 text-center text-xl font-bold rounded-lg border-2 bg-background text-foreground
                    transition-all outline-none
                    ${digit ? 'border-primary' : 'border-primary/30'}
                    ${error ? 'border-destructive' : ''}
                    focus:border-primary focus:ring-2 focus:ring-primary/20`}
                />
              ))}
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-destructive text-sm text-center"
              >
                {error}
                {attempts > 0 && attempts < 5 && (
                  <span className="text-muted-foreground"> ({5 - attempts} attempts left)</span>
                )}
              </motion.p>
            )}
          </div>

          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''}
            onChange={(token) => setRecaptchaToken(token || '')}
            className="flex justify-center"
          />

          {/* Verify Button */}
          <Button
            onClick={() => handleVerify()}
            disabled={isLoading || code.some(d => !d) || attempts >= 5 || !recaptchaToken}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-11"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Verifying...
              </span>
            ) : 'Verify & Sign In'}
          </Button>

          {/* Resend */}
          <div className="text-center">
            {resendCooldown > 0 ? (
              <p className="text-sm text-muted-foreground">
                Resend available in <span className="text-foreground font-mono">{resendCooldown}s</span>
              </p>
            ) : (
              <button
                onClick={handleResend}
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Didn't receive a code? Resend
              </button>
            )}
          </div>

          {/* Cancel */}
          <button
            onClick={handleCancel}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            ← Back to Login
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Demo code: <span className="font-mono text-primary">123456</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
