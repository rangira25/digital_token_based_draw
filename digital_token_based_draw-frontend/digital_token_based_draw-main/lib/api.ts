'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onLogout: (() => void) | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== 'undefined') {
    localStorage.setItem('drawAccessToken', access);
    localStorage.setItem('drawRefreshToken', refresh);
  }
}

export function loadTokens() {
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('drawAccessToken');
    refreshToken = localStorage.getItem('drawRefreshToken');
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('drawAccessToken');
    localStorage.removeItem('drawRefreshToken');
  }
}

export function setLogoutHandler(handler: () => void) {
  onLogout = handler;
}

export function getAccessToken() {
  return accessToken;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const json = await res.json();
    if (json.success) {
      setTokens(json.data.accessToken, json.data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
  skipAuth = false
): Promise<T> {
  loadTokens();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (!skipAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  async function fetchWithTimeout(u: string, init: RequestInit) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      return await fetch(u, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  let res = await fetchWithTimeout(url, { ...options, headers });

  // Token expired — try refresh
  if (res.status === 401 && !skipAuth && refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetchWithTimeout(url, { ...options, headers });
    } else {
      clearTokens();
      onLogout?.();
      throw new ApiError('Session expired', 401);
    }
  }

  const json = await res.json();

  if (!res.ok || json.success === false) {
    throw new ApiError(json.message || 'Request failed', res.status);
  }

  return json as T;
}

export const apiUrls = {
  // Auth
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
    updateProfile: '/auth/me',
    changePassword: '/auth/change-password',
    verifyEmail: '/auth/verify-email',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    setup2FA: '/auth/2fa/setup',
    verify2FA: '/auth/2fa/verify',
    disable2FA: '/auth/2fa/disable',
    topup: '/auth/topup',
  },
  // Draws
  draws: {
    list: '/draws',
    get: (id: string) => `/draws/${id}`,
    create: '/draws',
    update: (id: string) => `/draws/${id}`,
    delete: (id: string) => `/draws/${id}`,
    updateStatus: (id: string) => `/draws/${id}/status`,
    advanceStatus: (id: string) => `/draws/${id}/status`,
    execute: (id: string) => `/draws/${id}/execute`,
    winners: (id: string) => `/draws/${id}/winners`,
  },
  // Tokens
  tokens: {
    issue: '/tokens/issue',
    request: '/tokens/request',
    validate: (code: string) => `/tokens/validate/${code}`,
    submitEntry: '/tokens/submit-entry',
    drawTokens: (drawId: string) => `/tokens/draw/${drawId}`,
    pool: (drawId: string) => `/tokens/pool/${drawId}`,
    revoke: (id: string) => `/tokens/${id}/revoke`,
    myTokens: '/tokens/my/tokens',
    myEntries: '/tokens/my/entries',
  },
  // Winners
  winners: {
    list: '/winners',
    claim: (id: string) => `/winners/${id}/claim`,
    updateStatus: (id: string) => `/winners/${id}/status`,
  },
  // Notifications
  notifications: {
    list: '/notifications',
    send: '/notifications/send',
    markRead: (id: string) => `/notifications/${id}/read`,
    markAllRead: '/notifications/read-all',
  },
  // Analytics
  analytics: {
    get: '/analytics',
  },
  // Audit
  audit: {
    list: '/audit',
  },
  // Admin
  admin: {
    users: '/admin/users',
    user: (id: string) => `/admin/users/${id}`,
  },
};
