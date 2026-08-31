'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ReCAPTCHA from 'react-google-recaptcha';
import { useAuth, type UserRole, type RegisterData } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  IconUser,
  IconBuilding,
  IconSettings,
  IconShieldLock,
  IconClock,
  IconCheck,
  IconX,
  IconFileText,
  IconPaperclip,
} from '@tabler/icons-react';

type VerificationStatus = 'idle' | 'pending' | 'verified' | 'rejected';

interface UploadedDoc {
  name: string;
  size: number;
  type: string;
  preview?: string;
}

export default function AuthPage() {
  const router = useRouter();
  const { login, register, loginAttempts } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [recaptchaToken, setRecaptchaToken] = useState('');

  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('participant');
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const [recoveryEmailSent, setRecoveryEmailSent] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [error, setError] = useState('');
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDoc | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToEligibility, setAgreedToEligibility] = useState(false);
  const [registeredEmails] = useState<Set<string>>(new Set()); // mock duplicate check

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    nationalId: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    organizerLicense: '',
    dateOfBirth: '',
    address: '',
  });

  const recentFailures = loginAttempts.filter(
    a => !a.success && Date.now() - a.timestamp < 15 * 60 * 1000
  ).length;
  const isLockedOut = recentFailures >= 5;

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, text: '', color: '' };
    const checks = [/[A-Z]/, /[a-z]/, /[0-9]/, /[!@#$%^&*]/, /.{8,}/];
    const score = checks.filter(r => r.test(pwd)).length;
    if (score <= 2) return { score: 1, text: 'Weak', color: 'bg-red-500' };
    if (score === 3) return { score: 2, text: 'Fair', color: 'bg-yellow-500' };
    if (score === 4) return { score: 3, text: 'Good', color: 'bg-blue-500' };
    return { score: 4, text: 'Strong', color: 'bg-green-500' };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleVerifyEmail = async () => {
    if (!formData.email) { setError('Enter an email first'); return; }
    setVerifyingEmail(true);
    await new Promise(r => setTimeout(r, 1000));
    setEmailVerified(true);
    setVerifyingEmail(false);
  };

  // Document upload handler
  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      setUploadError('Only JPG, PNG, or PDF files are accepted');
      return;
    }
    if (file.size > maxSize) {
      setUploadError('File must be smaller than 5MB');
      return;
    }

    const doc: UploadedDoc = { name: file.name, size: file.size, type: file.type };

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => {
        setUploadedDoc({ ...doc, preview: ev.target?.result as string });
      };
      reader.readAsDataURL(file);
    } else {
      setUploadedDoc(doc);
    }
  };

  const formatFileSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  // Eligibility check: must be 18+
  const checkAgeEligibility = () => {
    if (!formData.dateOfBirth) return true; 
    const dob = new Date(formData.dateOfBirth);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return age >= 18;
  };

  const validate = () => {
    if (!formData.email || !formData.password) return setError('Email and password are required'), false;
    if (formData.password.length < 6) return setError('Password must be at least 6 characters'), false;
    if (!isLogin) {
      if (!formData.name) return setError('Full name is required'), false;
      if (!emailVerified) return setError('Please verify your email address'), false;
      if (formData.password !== formData.confirmPassword) return setError('Passwords do not match'), false;

      // Duplicate registration prevention
      if (registeredEmails.has(formData.email.toLowerCase())) {
        return setError('An account with this email already exists. Please log in.'), false;
      }

      if (selectedRole === 'participant') {
        if (!formData.phone) return setError('Phone number is required'), false;
        if (!formData.nationalId) return setError('National ID is required'), false;
        if (!formData.dateOfBirth) return setError('Date of birth is required'), false;
        if (!checkAgeEligibility()) return setError('You must be at least 18 years old to register'), false;
        if (!uploadedDoc) return setError('Please upload an identity verification document'), false;
        if (!agreedToEligibility) return setError('Please confirm you meet the eligibility criteria'), false;
      }
      if (selectedRole === 'organizer' || selectedRole === 'admin') {
        if (!formData.companyName) return setError('Company name is required'), false;
        if (!formData.organizerLicense) return setError('Organizer license is required'), false;
      }
      if (!agreedToTerms) return setError('Please agree to the Terms & Conditions'), false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!recaptchaToken) { setError('Please complete the reCAPTCHA verification'); return; }
    setIsLoading(true);
    setError('');
    try {
      if (isLogin) {
        const { requires2FA } = await login(formData.email, formData.password, selectedRole, recaptchaToken);
        if (requires2FA) {
          router.push('/auth/2fa');
        } else {
          router.push('/dashboard');
        }
      } else {
        const data: RegisterData = { ...formData, role: selectedRole };
        await register(data, recaptchaToken);

        if (selectedRole === 'participant') {
          // Show verification pending screen
          setVerificationStatus('pending');
          setRegistrationComplete(true);
        } else {
          router.push('/dashboard/organizer');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
      recaptchaRef.current?.reset();
      setRecaptchaToken('');
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) { setError('Enter your email'); return; }
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setRecoveryEmailSent(true);
    setIsLoading(false);
  };

  const pwStrength = getPasswordStrength(formData.password);

  // ── Registration Success / Verification Status Screen ──────────────────────
  if (registrationComplete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-6 text-center">
            {/* Status Icon */}
            <div className="flex justify-center text-primary">
              {verificationStatus === 'pending' && <IconClock size={48} stroke={1.5} />}
              {verificationStatus === 'verified' && <IconCheck size={48} stroke={1.5} />}
              {verificationStatus === 'rejected' && <IconX size={48} stroke={1.5} />}
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">
                {verificationStatus === 'pending' && 'Registration Submitted'}
                {verificationStatus === 'verified' && 'Account Verified'}
                {verificationStatus === 'rejected' && 'Verification Failed'}
              </h2>
              <p className="text-muted-foreground text-sm">
                {verificationStatus === 'pending' &&
                  'Your documents are under review. This usually takes 1–2 business days.'}
                {verificationStatus === 'verified' &&
                  'Your identity has been verified. You can now access all draws.'}
                {verificationStatus === 'rejected' &&
                  'We could not verify your identity. Please re-submit with a clearer document.'}
              </p>
            </div>

            {/* Verification Steps */}
            <div className="text-left space-y-3 bg-muted/30 rounded-lg p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Verification Progress
              </p>
              {[
                { label: 'Account Created', done: true },
                { label: 'Email Verified', done: true },
                { label: 'Document Submitted', done: !!uploadedDoc },
                { label: 'Identity Review', done: verificationStatus === 'verified', pending: verificationStatus === 'pending' },
                { label: 'Account Activated', done: verificationStatus === 'verified' },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    step.done
                      ? 'bg-green-500 text-white'
                      : step.pending
                        ? 'bg-yellow-500 text-white animate-pulse'
                        : 'bg-muted border border-primary/20 text-muted-foreground'
                  }`}>
                    {step.done ? <IconCheck size={12} stroke={2} /> : step.pending ? '…' : i + 1}
                  </div>
                  <span className={`text-sm ${
                    step.done ? 'text-foreground' : step.pending ? 'text-yellow-500' : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </span>
                  {step.pending && (
                    <span className="text-xs text-yellow-500 ml-auto">In Progress</span>
                  )}
                </div>
              ))}
            </div>

            {/* Submitted Document Summary */}
            {uploadedDoc && (
              <div className="text-left bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Submitted Document
                </p>
                <div className="flex items-center gap-3">
                  {uploadedDoc.preview ? (
                    <img src={uploadedDoc.preview} alt="ID" className="w-12 h-12 rounded object-cover border border-primary/20" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center text-primary"><IconFileText size={24} stroke={1.5} /></div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground truncate max-w-500px">{uploadedDoc.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(uploadedDoc.size)}</p>
                  </div>
                  <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${
                    verificationStatus === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                    verificationStatus === 'verified' ? 'bg-green-500/10 text-green-500' :
                    'bg-red-500/10 text-red-500'
                  }`}>
                    {verificationStatus}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {verificationStatus === 'rejected' && (
                <Button
                  onClick={() => { setRegistrationComplete(false); setUploadedDoc(null); setVerificationStatus('idle'); }}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Re-submit Documents
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => router.push('/auth')}
                className="w-full"
              >
                {verificationStatus === 'verified' ? 'Go to Login' : 'Back to Login'}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              You'll receive an email at <span className="font-mono text-primary">{formData.email}</span> once review is complete.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Main Auth Page ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-foreground">Digital Draw</h1>
            <p className="text-muted-foreground text-sm">Transparent, secure token-based draw system</p>
          </div>

          <motion.div
            className="bg-card border border-primary/20 rounded-lg p-8 space-y-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <AnimatePresence mode="wait">
              {/* ── Password Recovery ── */}
              {showPasswordRecovery ? (
                <motion.div
                  key="recovery"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Reset Password</h3>
                    <p className="text-sm text-muted-foreground mt-1">Enter your email and we'll send a reset link.</p>
                  </div>
                  {recoveryEmailSent ? (
                    <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm p-4 rounded text-center space-y-2">
                      <p className="font-semibold">Reset link sent!</p>
                      <p>Check your inbox at <span className="font-mono">{recoveryEmail}</span></p>
                    </div>
                  ) : (
                    <form onSubmit={handleRecovery} className="space-y-4">
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={recoveryEmail}
                        onChange={e => { setRecoveryEmail(e.target.value); setError(''); }}
                        className="border-primary/20 bg-background text-foreground"
                      />
                      {error && <p className="text-destructive text-sm">{error}</p>}
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" className="flex-1"
                          onClick={() => { setShowPasswordRecovery(false); setError(''); }}>
                          Back
                        </Button>
                        <Button type="submit" disabled={isLoading}
                          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                          {isLoading ? 'Sending...' : 'Send Link'}
                        </Button>
                      </div>
                    </form>
                  )}
                  {recoveryEmailSent && (
                    <Button variant="outline" className="w-full"
                      onClick={() => { setShowPasswordRecovery(false); setRecoveryEmailSent(false); setRecoveryEmail(''); }}>
                      Back to Login
                    </Button>
                  )}
                </motion.div>

              ) : (
                /* ── Login / Register ── */
                <motion.div
                  key="auth"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-5"
                >
                  {/* Tab Switch */}
                  <div className="flex gap-2 bg-muted rounded-lg p-1">
                    {['Login', 'Register'].map(tab => (
                      <button key={tab}
                        onClick={() => { setIsLogin(tab === 'Login'); setError(''); setEmailVerified(false); }}
                        className={`flex-1 py-2 px-4 rounded transition-all text-sm font-medium ${
                          (tab === 'Login') === isLogin
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Role Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Account Type</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'participant', label: 'Participant', icon: IconUser },
                          { value: 'organizer', label: 'Organizer', icon: IconBuilding },
                          { value: 'admin', label: 'Admin', icon: IconSettings },
                        ].map(r => (
                          <button key={r.value} type="button"
                            onClick={() => setSelectedRole(r.value as UserRole)}
                            className={`p-2 rounded border-2 transition-all text-center ${
                              selectedRole === r.value
                                ? 'border-primary bg-primary/10'
                                : 'border-primary/20 hover:border-primary/40'
                            }`}
                          >
                            <div className="flex justify-center text-foreground"><r.icon size={20} stroke={1.5} /></div>
                            <div className="text-xs font-medium text-foreground mt-1">{r.label}</div>
                          </button>
                        ))}
                      </div>
                      {(selectedRole === 'organizer' || selectedRole === 'admin') && (
                        <p className="text-xs text-primary flex items-center gap-1"><IconShieldLock size={14} stroke={2} /> 2FA verification required after login</p>
                      )}
                    </div>

                    {/* Full Name */}
                    {!isLogin && (
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1 block">Full Name</label>
                        <Input name="name" placeholder="  " value={formData.name}
                          onChange={handleChange} className="border-primary/20 bg-background text-foreground" />
                      </div>
                    )}

                    {/* Email */}
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Email Address</label>
                      <div className="flex gap-2">
                        <Input type="email" name="email" placeholder="you@example.com"
                          value={formData.email} onChange={handleChange}
                          disabled={!isLogin && emailVerified}
                          className="border-primary/20 bg-background text-foreground" />
                        {!isLogin && (
                          <Button type="button" variant="outline"
                            onClick={handleVerifyEmail}
                            disabled={verifyingEmail || emailVerified}
                            className={`shrink-0 ${emailVerified ? 'border-green-500 text-green-500' : ''}`}
                          >
                            {verifyingEmail ? '...' : emailVerified ? <IconCheck size={16} stroke={2} /> : 'Verify'}
                          </Button>
                        )}
                      </div>
                      {!isLogin && emailVerified && (
                        <p className="text-xs text-green-500 mt-1 flex items-center gap-1"><IconCheck size={12} stroke={2} /> Email verified</p>
                      )}
                    </div>

                    {/* ── Participant-specific fields ── */}
                    {!isLogin && selectedRole === 'participant' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1 block">Phone Number</label>
                            <Input type="tel" name="phone" placeholder="+250 7XX XXX XXX"
                              value={formData.phone} onChange={handleChange}
                              className="border-primary/20 bg-background text-foreground" />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1 block">Date of Birth</label>
                            <Input type="date" name="dateOfBirth" value={formData.dateOfBirth}
                              onChange={handleChange} max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                              className="border-primary/20 bg-background text-foreground" />
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-foreground mb-1 block">National ID / Passport Number</label>
                          <Input name="nationalId" placeholder="ID number"
                            value={formData.nationalId} onChange={handleChange}
                            className="border-primary/20 bg-background text-foreground" />
                          <p className="text-xs text-muted-foreground mt-1">Used for identity verification and duplicate prevention</p>
                        </div>

                        {/* Identity Document Upload */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground block">
                            Identity Verification Document <span className="text-destructive">*</span>
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Upload a clear photo or scan of your National ID, Passport, or Driver's License
                          </p>

                          {uploadedDoc ? (
                            <div className="border border-green-500/30 bg-green-500/5 rounded-lg p-3 flex items-center gap-3">
                              {uploadedDoc.preview ? (
                                <img src={uploadedDoc.preview} alt="ID preview"
                                  className="w-12 h-12 rounded object-cover border border-primary/20" />
                              ) : (
                                <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center text-primary"><IconFileText size={24} stroke={1.5} /></div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{uploadedDoc.name}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(uploadedDoc.size)}</p>
                              </div>
                              <button type="button"
                                onClick={() => { setUploadedDoc(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                              >
                                <IconX size={18} stroke={2} />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => fileInputRef.current?.click()}
                              className="border-2 border-dashed border-primary/30 hover:border-primary/50 rounded-lg p-6 text-center cursor-pointer transition-all group"
                            >
                              <div className="flex justify-center mb-2 text-primary"><IconPaperclip size={28} stroke={1.5} /></div>
                              <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                Click to upload or drag & drop
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">JPG, PNG or PDF · Max 5MB</p>
                            </div>
                          )}

                          <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf"
                            onChange={handleDocUpload} className="hidden" />

                          {uploadError && (
                            <p className="text-xs text-destructive">{uploadError}</p>
                          )}
                        </div>

                        {/* Eligibility Criteria */}
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                          <p className="text-sm font-semibold text-foreground">Eligibility Criteria</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li className={`flex items-center gap-2 ${formData.dateOfBirth && checkAgeEligibility() ? 'text-green-400' : ''}`}>
                              <span>{formData.dateOfBirth && checkAgeEligibility() ? <IconCheck size={12} stroke={2} /> : '○'}</span>
                              Must be 18 years of age or older
                            </li>
                            <li className={`flex items-center gap-2 ${formData.nationalId ? 'text-green-400' : ''}`}>
                              <span>{formData.nationalId ? <IconCheck size={12} stroke={2} /> : '○'}</span>
                              Valid government-issued ID required
                            </li>
                            <li className={`flex items-center gap-2 ${uploadedDoc ? 'text-green-400' : ''}`}>
                              <span>{uploadedDoc ? <IconCheck size={12} stroke={2} /> : '○'}</span>
                              Document upload required for verification
                            </li>
                            <li className={`flex items-center gap-2 ${emailVerified ? 'text-green-400' : ''}`}>
                              <span>{emailVerified ? <IconCheck size={12} stroke={2} /> : '○'}</span>
                              Verified email address
                            </li>
                          </ul>
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input type="checkbox" checked={agreedToEligibility}
                              onChange={e => setAgreedToEligibility(e.target.checked)}
                              className="mt-0.5 accent-primary" />
                            <span className="text-xs text-muted-foreground">
                              I confirm I meet all eligibility criteria and the information provided is accurate
                            </span>
                          </label>
                        </div>
                      </>
                    )}

                    {/* ── Organizer/Admin fields ── */}
                    {!isLogin && (selectedRole === 'organizer' || selectedRole === 'admin') && (
                      <>
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1 block">Company Name</label>
                          <Input name="companyName" placeholder="Your Company Ltd."
                            value={formData.companyName} onChange={handleChange}
                            className="border-primary/20 bg-background text-foreground" />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1 block">Event Organizer License</label>
                          <Input name="organizerLicense" placeholder="EOL-2024-XXXXX"
                            value={formData.organizerLicense} onChange={handleChange}
                            className="border-primary/20 bg-background text-foreground" />
                          <p className="text-xs text-muted-foreground mt-1">Required for organizer verification</p>
                        </div>
                      </>
                    )}

                    {/* Password */}
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Password</label>
                      <Input type="password" name="password" placeholder="••••••••"
                        value={formData.password} onChange={handleChange}
                        className="border-primary/20 bg-background text-foreground" />
                      {!isLogin && formData.password && (
                        <div className="mt-2 space-y-1">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map(i => (
                              <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                                i <= pwStrength.score ? pwStrength.color : 'bg-primary/20'
                              }`} />
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Strength: <span className="text-foreground font-medium">{pwStrength.text}</span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    {!isLogin && (
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1 block">Confirm Password</label>
                        <Input type="password" name="confirmPassword" placeholder="••••••••"
                          value={formData.confirmPassword} onChange={handleChange}
                          className={`border-primary/20 bg-background text-foreground ${
                            formData.confirmPassword && formData.password !== formData.confirmPassword
                              ? 'border-red-500/50' : ''
                          }`} />
                        {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                          <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
                        )}
                      </div>
                    )}

                    {/* Terms & Conditions */}
                    {!isLogin && (
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={agreedToTerms}
                          onChange={e => setAgreedToTerms(e.target.checked)}
                          className="mt-0.5 accent-primary" />
                        <span className="text-xs text-muted-foreground">
                          I agree to the{' '}
                          <button type="button" className="text-primary hover:underline">Terms & Conditions</button>
                          {' '}and{' '}
                          <button type="button" className="text-primary hover:underline">Privacy Policy</button>
                        </span>
                      </label>
                    )}

                    {error && (
                      <div className="bg-destructive/10 border border-destructive/40 text-destructive text-sm p-3 rounded">
                        {error}
                      </div>
                    )}

                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''}
                      onChange={(token) => setRecaptchaToken(token || '')}
                      className="flex justify-center"
                    />

                    <Button type="submit" disabled={isLoading || !recaptchaToken}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                      {isLoading
                        ? 'Processing...'
                        : isLogin
                          ? `Sign In${selectedRole === 'organizer' || selectedRole === 'admin' ? ' → Verify 2FA' : ''}`
                          : 'Create Account'}
                    </Button>

                    {isLogin && (
                      <button type="button"
                        onClick={() => { setShowPasswordRecovery(true); setError(''); }}
                        className="w-full text-sm text-primary hover:text-primary/80 transition-colors text-center">
                        Forgot Password?
                      </button>
                    )}
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            
          </motion.div>

          <p className="text-center text-xs text-muted-foreground">
            Digital Token Draw System © 2026
          </p>
        </div>
      </motion.div>
    </div>
  );
}
