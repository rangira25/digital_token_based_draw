'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, apiUrls, setTokens, clearTokens, loadTokens, setLogoutHandler, ApiError } from '@/lib/api';

export type UserRole = 'participant' | 'organizer' | 'admin' | null;

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  nationalId?: string;
  companyName?: string;
  organizerLicense?: string;
  role: UserRole;
  avatar?: string;
  joinDate: string;
  twoFactorEnabled: boolean;
  twoFactorVerified?: boolean;
  balance?: number;
}

export interface RegisterData {
  name: string;
  email: string;
  phone?: string;
  nationalId?: string;
  password: string;
  role: UserRole;
  companyName?: string;
  organizerLicense?: string;
}

interface LoginAttempt {
  timestamp: number;
  success: boolean;
  email: string;
}

interface AuthContextType {
  user: User | null;
  pendingUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginAttempts: LoginAttempt[];
  login: (email: string, password: string, role: UserRole, recaptchaToken?: string) => Promise<{ requires2FA: boolean }>;
  verify2FA: (code: string, recaptchaToken?: string) => Promise<void>;
  register: (data: RegisterData, recaptchaToken?: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  resetLoginAttempts: () => void;
  refreshUser: () => Promise<void>;
}

const SESSION_TIMEOUT = 30 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapBackendUser(data: any): User {
  return {
    id: data.id,
    name: data.full_name,
    email: data.email,
    phone: data.phone,
    nationalId: data.national_id,
    companyName: data.company_name,
    organizerLicense: data.organizer_license,
    role: data.role,
    avatar: data.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.email}`,
    joinDate: data.created_at || new Date().toISOString(),
    twoFactorEnabled: data.totp_enabled || false,
    twoFactorVerified: false,
    balance: parseFloat(data.balance) || 0,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const doLogout = useCallback(() => {
    setUser(null);
    setPendingUser(null);
    clearTokens();
    localStorage.removeItem('drawSystemUser');
    localStorage.removeItem('drawPendingUser');
  }, []);

  setLogoutHandler(doLogout);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api<{ success: boolean; data: any }>(apiUrls.auth.me);
      if (res.success && res.data) {
        const mapped = mapBackendUser(res.data);
        setUser(mapped);
        localStorage.setItem('drawSystemUser', JSON.stringify(mapped));
      }
    } catch {
      // Don't logout on profile fetch failure — keep cached user.
      // The api() function handles token refresh automatically.
      // Only logout on explicit logout or 401 after refresh fails.
    }
  }, []);

  useEffect(() => {
    loadTokens();
    const storedUser = localStorage.getItem('drawSystemUser');
    const storedAttempts = localStorage.getItem('drawLoginAttempts');
    const storedActivity = localStorage.getItem('drawLastActivity');

    if (storedUser) setUser(JSON.parse(storedUser));
    if (storedAttempts) setLoginAttempts(JSON.parse(storedAttempts));
    if (storedActivity) setLastActivity(Number(storedActivity));

    // Safety net: unblock loading after 4 seconds no matter what
    const safetyTimer = setTimeout(() => setIsLoading(false), 4000);

    if (storedUser) {
      fetchProfile().finally(() => {
        clearTimeout(safetyTimer);
        setIsLoading(false);
      });
    } else {
      clearTimeout(safetyTimer);
      setIsLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > SESSION_TIMEOUT) {
        doLogout();
      }
    }, 60 * 1000);

    const updateActivity = () => {
      setLastActivity(Date.now());
      localStorage.setItem('drawLastActivity', String(Date.now()));
    };
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
    };
  }, [user, lastActivity, doLogout]);

  const isLockedOut = () => {
    const recent = loginAttempts.filter(
      a => !a.success && Date.now() - a.timestamp < LOCKOUT_DURATION
    );
    return recent.length >= MAX_LOGIN_ATTEMPTS;
  };

  const recordAttempt = (email: string, success: boolean) => {
    const attempt: LoginAttempt = { timestamp: Date.now(), success, email };
    const updated = [...loginAttempts, attempt].slice(-20);
    setLoginAttempts(updated);
    localStorage.setItem('drawLoginAttempts', JSON.stringify(updated));
  };

  const login = async (email: string, password: string, role: UserRole, recaptchaToken?: string): Promise<{ requires2FA: boolean }> => {
    try {
      const body: Record<string, any> = { email, password };
      if (recaptchaToken) body.recaptcha_token = recaptchaToken;
      const res = await api<{ success: boolean; requires2FA?: boolean; data?: { accessToken: string; refreshToken: string; user: any } }>(
        apiUrls.auth.login,
        { method: 'POST', body: JSON.stringify(body) },
        true
      );

      if (res.requires2FA) {
        const tempUser: User = {
          id: '',
          name: email.split('@')[0],
          email,
          role,
          joinDate: new Date().toISOString(),
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
          twoFactorEnabled: true,
          twoFactorVerified: false,
        };
        setPendingUser(tempUser);
        localStorage.setItem('drawPendingUser', JSON.stringify(tempUser));
        recordAttempt(email, true);
        return { requires2FA: true };
      }

      if (res.data) {
        setTokens(res.data.accessToken, res.data.refreshToken);
        const mapped = mapBackendUser(res.data.user);
        setUser(mapped);
        setPendingUser(null);
        localStorage.setItem('drawSystemUser', JSON.stringify(mapped));
        localStorage.removeItem('drawPendingUser');
        recordAttempt(email, true);
      }

      return { requires2FA: false };
    } catch (err: any) {
      recordAttempt(email, false);
      throw err;
    }
  };

  const verify2FA = async (code: string, recaptchaToken?: string) => {
    if (!pendingUser) throw new Error('No pending authentication');

    try {
      const body: Record<string, any> = { email: pendingUser.email, password: '', totp_code: code };
      if (recaptchaToken) body.recaptcha_token = recaptchaToken;
      const res = await api<{ success: boolean; data: { accessToken: string; refreshToken: string; user: any } }>(
        apiUrls.auth.login,
        { method: 'POST', body: JSON.stringify(body) },
        true
      );

      if (res.data) {
        setTokens(res.data.accessToken, res.data.refreshToken);
        const mapped = mapBackendUser(res.data.user);
        const verifiedUser: User = { ...mapped, twoFactorVerified: true };
        setUser(verifiedUser);
        setPendingUser(null);
        localStorage.setItem('drawSystemUser', JSON.stringify(verifiedUser));
        localStorage.removeItem('drawPendingUser');
      }
    } catch (err: any) {
      throw err;
    }
  };

  const register = async (data: RegisterData, recaptchaToken?: string) => {
    const body: Record<string, any> = {
      email: data.email,
      password: data.password,
      full_name: data.name,
      role: data.role || 'participant',
    };
    if (data.phone) body.phone = data.phone;
    if (data.nationalId) body.national_id = data.nationalId;
    if (data.companyName) body.company_name = data.companyName;
    if (data.organizerLicense) body.organizer_license = data.organizerLicense;
    if (recaptchaToken) body.recaptcha_token = recaptchaToken;

    await api<{ success: boolean; data: any }>(
      apiUrls.auth.register,
      { method: 'POST', body: JSON.stringify(body) },
      true
    );
  };

  const logout = useCallback(async () => {
    try {
      await api(apiUrls.auth.logout, { method: 'POST' }).catch(() => {});
    } catch {}
    doLogout();
    localStorage.removeItem('drawLoginAttempts');
    window.location.href = '/auth';
  }, [doLogout]);

  const switchRole = (role: UserRole) => {
    if (user) {
      const updated = { ...user, role };
      setUser(updated);
      localStorage.setItem('drawSystemUser', JSON.stringify(updated));
    }
  };

  const resetLoginAttempts = () => {
    setLoginAttempts([]);
    localStorage.removeItem('drawLoginAttempts');
  };

  return (
    <AuthContext.Provider value={{
      user,
      pendingUser,
      isAuthenticated: !!user,
      isLoading,
      loginAttempts,
      login,
      verify2FA,
      register,
      logout,
      switchRole,
      resetLoginAttempts,
      refreshUser: fetchProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
