'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, apiUrls } from './api';

// ─── Generic Fetch Hook ───────────────────────────────────────────
export function useApi<T = unknown>(
  url: string | null,
  options?: RequestInit
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ success: boolean; data: T }>(url, options);
      setData(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// ─── Draws ─────────────────────────────────────────────────────────
export function useDraws(status?: string) {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDraws = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = status ? `?status=${status}` : '';
      const res = await api<{ success: boolean; data: any[] }>(`${apiUrls.draws.list}${params}`);
      setData(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { fetchDraws(); }, [fetchDraws]);

  return { data, loading, error, refetch: fetchDraws };
}

export function useDraw(id: string | null) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDraw = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ success: boolean; data: any }>(apiUrls.draws.get(id));
      setData(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDraw(); }, [fetchDraw]);

  return { data, loading, error, refetch: fetchDraw };
}

// ─── Tokens ────────────────────────────────────────────────────────
export function useTokens() {
  return useApi<any[]>('/tokens/my/tokens');
}

export function useDrawTokens(drawId: string | null) {
  const url = drawId ? `/tokens/draw/${drawId}` : null;
  return useApi<any[]>(url);
}

// ─── Analytics ─────────────────────────────────────────────────────
export function useAnalytics() {
  return useApi<any>('/analytics');
}

// ─── Notifications ─────────────────────────────────────────────────
export function useNotifications() {
  const [data, setData] = useState<any[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ success: boolean; data: any[]; unread_count: number }>(apiUrls.notifications.list);
      setData(res.data);
      setUnreadCount(res.unread_count);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, unreadCount, loading, error, refetch: fetch };
}

// ─── Winners ───────────────────────────────────────────────────────
export function useWinners(drawId?: string) {
  const params = drawId ? `?draw_id=${drawId}` : '';
  return useApi<any[]>(`/winners${params}`);
}

// ─── Entries ───────────────────────────────────────────────────────
export function useMyEntries() {
  return useApi<any[]>('/tokens/my/entries');
}

// ─── Audit Logs ────────────────────────────────────────────────────
export function useAuditLogs() {
  return useApi<any[]>('/audit');
}

// ─── Admin Users ───────────────────────────────────────────────────
export function useAdminUsers() {
  return useApi<any[]>('/admin/users');
}
