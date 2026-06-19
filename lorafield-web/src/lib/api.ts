import { getToken } from './token';
import type {
  Crop,
  CreateFarmPayload,
  Farm,
  FarmSummary,
  Reading,
  IrrigationLog,
  User,
  Weather,
} from '@/types';

const BASE = '/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.detail ?? body.message ?? message;
    } catch {
      // body bukan JSON, pakai statusText aja
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // --- Auth ---
  login: (email: string, password: string) =>
    apiFetch<{ access_token: string; token_type: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (name: string, email: string, password: string) =>
    // shape response belum diverifikasi dengan backend
    apiFetch<unknown>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  forgotPassword: (email: string) =>
    // shape response belum diverifikasi dengan backend
    apiFetch<unknown>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Tahap 1 lupa password: verifikasi OTP. Endpoint dikonfirmasi dari backend asli
  // (main.py:832 -> /api/auth/reset-password/verify). Catatan: tabel CLAUDE.md
  // menyebut /api/auth/verify-reset-code yang TIDAK ada di backend.
  verifyResetCode: (token: string) =>
    // shape response belum diverifikasi dengan backend
    apiFetch<unknown>('/auth/reset-password/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    // shape response belum diverifikasi dengan backend
    apiFetch<unknown>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    // shape response belum diverifikasi dengan backend
    apiFetch<unknown>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  updateProfile: (phone: string) =>
    // shape response belum diverifikasi dengan backend
    apiFetch<unknown>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ phone }),
    }),

  // --- Farms ---
  getFarms: () => apiFetch<{ items: Farm[] }>('/farms'),
  getFarm: (id: string) => apiFetch<Farm>(`/farms/${id}`),
  getFarmSummary: (id: string) => apiFetch<FarmSummary>(`/farms/${id}/summary`),

  createFarm: (payload: CreateFarmPayload) =>
    apiFetch<{ farm: Farm }>('/farms', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteFarm: (id: string) => apiFetch<void>(`/farms/${id}`, { method: 'DELETE' }),

  // --- Utils ---
  getCrops: (q = '') =>
    apiFetch<{ crops: Crop[] }>(`/crops${q ? `?q=${encodeURIComponent(q)}` : ''}`),

  resolveAdm4: (lat: number, lon: number, q = '') =>
    apiFetch<{ adm4: string; found: boolean }>(
      `/utils/resolve-adm4?${new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        q,
      }).toString()}`,
    ),

  // --- Data ---
  getReadings: (nodeId: string, limit = 50) =>
    apiFetch<{ items: Reading[] }>(`/nodes/${nodeId}/readings?limit=${limit}`),

  getWeather: (adm4_code: string) => apiFetch<Weather>(`/weather/${adm4_code}`),

  getLogs: (limit = 50) => apiFetch<{ items: IrrigationLog[] }>(`/logs?limit=${limit}`),
};
