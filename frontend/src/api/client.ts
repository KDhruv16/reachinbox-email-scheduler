import axios from 'axios';
import { User, EmailJob, DashboardStats, ScheduleEmailPayload, SmtpInfo } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  me: async (): Promise<{ user: User }> => {
    const res = await apiClient.get('/api/auth/me');
    return res.data;
  },
  devLogin: async (): Promise<{ user: User }> => {
    const res = await apiClient.post('/api/auth/dev-login');
    if (res.data?.token) {
      localStorage.setItem('reachinbox_token', res.data.token);
    }
    return res.data;
  },
  logout: async (): Promise<void> => {
    localStorage.removeItem('reachinbox_token');
    await apiClient.post('/api/auth/logout').catch(() => {});
  },
};

export const emailApi = {
  schedule: async (payload: ScheduleEmailPayload) => {
    const res = await apiClient.post('/api/emails/schedule', payload);
    return res.data;
  },
  getScheduled: async (
    page = 1,
    limit = 20,
    search = '',
    status = ''
  ): Promise<{ total: number; emails: EmailJob[] }> => {
    const res = await apiClient.get('/api/emails/scheduled', {
      params: { page, limit, search: search || undefined, status: status || undefined },
    });
    return res.data;
  },
  getSent: async (
    page = 1,
    limit = 20,
    search = '',
    status = ''
  ): Promise<{ total: number; emails: EmailJob[] }> => {
    const res = await apiClient.get('/api/emails/sent', {
      params: { page, limit, search: search || undefined, status: status || undefined },
    });
    return res.data;
  },
  search: async (
    q: string,
    status?: string,
    page = 1,
    limit = 20
  ): Promise<{ total: number; emails: EmailJob[]; source: string }> => {
    const res = await apiClient.get('/api/emails/search', {
      params: { q, status, page, limit },
    });
    return res.data;
  },
  getStats: async (): Promise<DashboardStats> => {
    const res = await apiClient.get('/api/emails/stats');
    return res.data;
  },
  getById: async (id: string): Promise<EmailJob> => {
    const res = await apiClient.get(`/api/emails/${id}`);
    return res.data;
  },
  cancel: async (id: string): Promise<{ success: boolean; canceledEmail: EmailJob }> => {
    const res = await apiClient.delete(`/api/emails/${id}`);
    return res.data;
  },
  getSmtpInfo: async (): Promise<{ smtp: SmtpInfo }> => {
    const res = await apiClient.get('/api/emails/smtp-info');
    return res.data;
  },
  reindex: async (): Promise<{ success: boolean; totalReindexed: number }> => {
    const res = await apiClient.post('/api/emails/reindex');
    return res.data;
  },
};

export const slackApi = {
  disconnect: async () => {
    const res = await apiClient.post('/api/slack/disconnect');
    return res.data;
  },
};

export const healthApi = {
  check: async () => {
    const res = await apiClient.get('/api/health');
    return res.data;
  },
};
