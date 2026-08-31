'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, apiUrls } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { IconCheck, IconClock, IconUser, IconShield, IconPlus, IconCircleCheck, IconHourglass, IconX } from '@tabler/icons-react';

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  national_id: string;
  date_of_birth: string;
  status: string;
  email_verified: boolean;
  created_at: string;
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: '',
    email: '',
    phone: '',
    national_id: '',
    date_of_birth: '',
    status: '',
    email_verified: false,
    created_at: '',
  });
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpPhone, setTopUpPhone] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpMessage, setTopUpMessage] = useState('');
  const [topUpError, setTopUpError] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api<{ success: boolean; data: ProfileData }>(apiUrls.auth.me);
      setProfileData(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load profile' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user, fetchProfile]);

  useEffect(() => {
    if (!user || user.role !== 'participant') {
      router.push('/auth');
    }
  }, [user, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api(apiUrls.auth.updateProfile, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: profileData.full_name,
          phone: profileData.phone,
          date_of_birth: profileData.date_of_birth,
        }),
      });
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
      setEditMode(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to save changes' });
    } finally {
      setSaving(false);
    }
  };

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0) { setTopUpError('Enter a valid amount'); return; }
    setTopUpLoading(true);
    setTopUpError('');
    setTopUpMessage('');
    try {
      const res = await api<{ success: boolean; data: any }>(apiUrls.auth.topup, {
        method: 'POST',
        body: JSON.stringify({ amount, phone: topUpPhone }),
      });
      if (res.success) {
        await refreshUser();
        setTopUpMessage(`$${amount.toFixed(2)} added to your balance`);
        setTopUpAmount('');
        setTopUpPhone('');
      }
    } catch (err: any) {
      setTopUpError(err.message);
    }
    setTopUpLoading(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground font-mono">Loading profile...</p>
      </div>
    );
  }

  const verificationStatus = profileData.status || 'pending';
  const createdAt = profileData.created_at ? new Date(profileData.created_at) : new Date();

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 space-y-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Profile & Verification</h1>
          <p className="text-muted-foreground">Manage your account and verification status</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="lg:col-span-2 space-y-6">
            {/* Verification Status */}
            <div className={`border rounded-lg p-8 space-y-4 ${
              verificationStatus === 'active'
                ? 'bg-green-500/5 border-green-500/30'
                : verificationStatus === 'pending'
                  ? 'bg-yellow-500/5 border-yellow-500/30'
                  : 'bg-red-500/5 border-red-500/30'
            }`}>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-foreground">Verification Status</h2>
                  <p className={`font-mono text-sm ${
                    verificationStatus === 'active' ? 'text-green-600' :
                    verificationStatus === 'pending' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {verificationStatus.toUpperCase()}
                  </p>
                </div>
                <span className={`flex items-center ${
                  verificationStatus === 'active' ? 'text-green-600' :
                  verificationStatus === 'pending' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {verificationStatus === 'active' ? <IconCircleCheck size={32} stroke={1.5} /> : verificationStatus === 'pending' ? <IconHourglass size={32} stroke={1.5} /> : <IconX size={32} stroke={1.5} />}
                </span>
              </div>

              {verificationStatus === 'active' && (
                <p className="text-sm text-green-600">Your identity has been verified. You can participate in all draws.</p>
              )}
              {verificationStatus === 'pending' && (
                <p className="text-sm text-yellow-600">Your verification is pending. This usually takes 1-2 business days.</p>
              )}
            </div>

            {/* Profile Information */}
            <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">Personal Information</h2>
                <Button
                  onClick={() => editMode ? handleSave() : setEditMode(true)}
                  variant={editMode ? 'default' : 'outline'}
                  className={editMode ? 'bg-slate-800 text-white' : ''}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : editMode ? 'Save Changes' : 'Edit Profile'}
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { label: 'Full Name', key: 'full_name' },
                  { label: 'Email', key: 'email', disabled: true },
                  { label: 'Phone', key: 'phone' },
                  { label: 'Date of Birth', key: 'date_of_birth', type: 'date' },
                  { label: 'National ID', key: 'national_id', disabled: true },
                ].map((field) => (
                  <div key={field.key} className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{field.label}</label>
                    {editMode && !field.disabled ? (
                      <Input
                        name={field.key}
                        type={(field as any).type || 'text'}
                        value={(profileData as any)[field.key] || ''}
                        onChange={handleChange}
                        className="border-primary/20 bg-background text-foreground"
                      />
                    ) : (
                      <p className="p-3 bg-muted rounded text-foreground font-mono text-sm">
                        {(profileData as any)[field.key] || '—'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Eligibility */}
            <div className="bg-card border border-primary/20 rounded-lg p-8 space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Eligibility</h2>
              <div className="space-y-3">
                {[
                  { check: true, label: 'Age 18+' },
                  { check: !!profileData.national_id, label: 'Valid National ID' },
                  { check: profileData.email_verified, label: 'Email Verified' },
                  { check: !!profileData.phone, label: 'Phone Verified' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-muted rounded">
                    <span className={`text-lg ${item.check ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {item.check ? <IconCheck size={18} /> : 'circle'}
                    </span>
                    <span className="text-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Sidebar */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="space-y-6">
            <div className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
              <h3 className="font-bold text-foreground">Account Balance</h3>
              <p className="text-3xl font-bold text-slate-700">${(user?.balance || 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Available for token purchases and prize payouts</p>
              <Button onClick={() => setShowTopUp(true)} size="sm" className="w-full bg-slate-800 text-white hover:bg-slate-700">
                <IconPlus size={14} stroke={2} /> Top Up
              </Button>
            </div>
            <div className="bg-card border border-primary/20 rounded-lg p-6 space-y-4">
              <h3 className="font-bold text-foreground">Verification Timeline</h3>
              <div className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <span className="text-slate-700 font-bold"><IconCheck size={16} /></span>
                  <div>
                    <p className="font-medium text-foreground">Account Created</p>
                    <p className="text-xs text-muted-foreground">{createdAt.toLocaleDateString()}</p>
                  </div>
                </div>
                {profileData.email_verified && (
                  <div className="flex gap-3">
                    <span className="text-slate-700 font-bold"><IconCheck size={16} /></span>
                    <div>
                      <p className="font-medium text-foreground">Email Verified</p>
                      <p className="text-xs text-muted-foreground">Verified</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <span className={`${verificationStatus === 'active' ? 'text-slate-700' : 'text-muted-foreground'} font-bold`}>
                    {verificationStatus === 'active' ? <IconCheck size={16} /> : <IconClock size={16} />}
                  </span>
                  <div>
                    <p className="font-medium text-foreground">Identity Verified</p>
                    <p className="text-xs text-muted-foreground">
                      {verificationStatus === 'active' ? 'Verified' : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted border border-primary/20 rounded-lg p-6 space-y-4">
              <h3 className="font-bold text-foreground">Document Verification</h3>
              <p className="text-sm text-muted-foreground">Your ID is valid for 2 years. You will be notified before expiration.</p>
              <Button variant="outline" className="w-full">Upload New ID</Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Top Up Modal */}
      <AnimatePresence>
        {showTopUp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowTopUp(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-primary/20 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Top Up Balance</h2>
                <button onClick={() => setShowTopUp(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
              </div>

              {topUpMessage && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-600 text-center">{topUpMessage}</div>
              )}
              {topUpError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-600 text-center">{topUpError}</div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Amount ($)</label>
                  <Input type="number" min="1" step="0.01" placeholder="e.g. 50.00"
                    value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)}
                    className="border-primary/20 bg-background text-foreground" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Phone Number</label>
                  <Input type="tel" placeholder="+1 555 000 0000"
                    value={topUpPhone} onChange={e => setTopUpPhone(e.target.value)}
                    className="border-primary/20 bg-background text-foreground" />
                  <p className="text-xs text-muted-foreground mt-1">Used for payment reference (no actual charge)</p>
                </div>
              </div>

              <Button onClick={handleTopUp} disabled={topUpLoading || !topUpAmount.trim()}
                className="w-full bg-slate-800 text-white hover:bg-slate-700">
                {topUpLoading ? 'Processing...' : `Top Up $${parseFloat(topUpAmount) || 0}`}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
