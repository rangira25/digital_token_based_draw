'use client';

import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { IconSettings, IconClock, IconLock, IconHash, IconCheck, IconAlertTriangle } from '@tabler/icons-react';

interface SecuritySettings {
  sessionTimeout: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
}

const DEFAULTS: SecuritySettings = {
  sessionTimeout: 30,
  maxLoginAttempts: 5,
  lockoutDuration: 15,
};

const STORAGE_KEY = 'raffall_admin_security_settings';

function loadSettings(): SecuritySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

function saveSettings(s: SecuritySettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export default function OrganizerSettingsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<SecuritySettings>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    const original = loadSettings();
    setDirty(JSON.stringify(settings) !== JSON.stringify(original));
    setSaved(false);
  }, [settings]);

  if (isLoading || !user || user.role !== 'admin') return null;

  const handleSave = () => {
    saveSettings(settings);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const update = (key: keyof SecuritySettings, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setSettings(prev => ({ ...prev, [key]: num }));
    } else if (value === '') {
      setSettings(prev => ({ ...prev, [key]: 0 }));
    }
  };

  const fields: {
    key: keyof SecuritySettings;
    label: string;
    sub: string;
    icon: React.ReactNode;
    unit: string;
    min: number;
    max: number;
  }[] = [
    {
      key: 'sessionTimeout',
      label: 'Session Timeout',
      sub: 'Auto logout after inactivity (client-side, minutes)',
      icon: <IconClock size={20} stroke={1.5} />,
      unit: 'min',
      min: 5,
      max: 480,
    },
    {
      key: 'maxLoginAttempts',
      label: 'Max Login Attempts',
      sub: 'Before temporary lockout',
      icon: <IconHash size={20} stroke={1.5} />,
      unit: 'attempts',
      min: 1,
      max: 50,
    },
    {
      key: 'lockoutDuration',
      label: 'Lockout Duration',
      sub: 'After max attempts exceeded (minutes)',
      icon: <IconLock size={20} stroke={1.5} />,
      unit: 'min',
      min: 1,
      max: 120,
    },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 space-y-8 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground flex items-center gap-3">
              <IconSettings size={32} stroke={1.5} className="text-muted-foreground" />
              System Settings
            </h1>
            <p className="text-muted-foreground">Configure security policies and system parameters.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-primary/20 rounded-xl p-6 space-y-6"
          >
            <div>
              <h2 className="text-xl font-bold text-foreground">Session & Lockout Policy</h2>
              <p className="text-sm text-muted-foreground mt-1">Adjust security thresholds. Changes apply to the next session.</p>
            </div>

            <div className="space-y-5">
              {fields.map(f => (
                <div key={f.key} className="flex items-center justify-between gap-6 p-4 bg-background rounded-lg border border-primary/10">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-muted-foreground shrink-0">{f.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{f.label}</p>
                      <p className="text-xs text-muted-foreground">{f.sub}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      min={f.min}
                      max={f.max}
                      value={settings[f.key]}
                      onChange={e => update(f.key, e.target.value)}
                      className="w-24 text-center font-mono text-sm border-primary/20 bg-card text-foreground"
                    />
                    <span className="text-xs text-muted-foreground w-14">{f.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {settings.sessionTimeout < 5 && (
              <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <IconAlertTriangle size={14} stroke={2} />
                Session timeout below 5 minutes may cause frequent logouts.
              </div>
            )}
            {settings.lockoutDuration > settings.sessionTimeout && (
              <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <IconAlertTriangle size={14} stroke={2} />
                Lockout duration exceeds session timeout — locked-out users will be logged out before the lockout expires.
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3"
          >
            <Button
              onClick={handleSave}
              disabled={!dirty}
              className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {saved ? <><IconCheck size={14} className="mr-1" /> Saved</> : 'Save Settings'}
            </Button>
            {dirty && !saved && (
              <p className="text-xs text-muted-foreground">Unsaved changes</p>
            )}
            {saved && (
              <p className="text-xs text-green-600">Settings saved successfully.</p>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}