import { getToken } from './token';
import type { AppLanguage } from '@/i18n/language';
import type {
  Crop,
  CreateFarmPayload,
  Farm,
  FarmSummary,
  FarmGateway,
  GatewayLog,
  Reading,
  IrrigationLog,
  User,
} from '@/types';

const BASE = '/api';

// Tanpa ini, backend yang menggantung bikin status sesi tidak pernah selesai.
export const SESSION_REQUEST_TIMEOUT_MS = 8000;

// Dipancarkan saat backend menolak token yang dipakai. AuthProvider yang menangani.
export const UNAUTHORIZED_EVENT = 'lf:unauthorized';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface FetchBehavior {
  // Di endpoint yang cek kredensial lewat body, 401 berarti input salah, bukan sesi mati.
  ignoreUnauthorized?: boolean;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  { ignoreUnauthorized = false }: FetchBehavior = {},
): Promise<T> {
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
    if (res.status === 401 && token && !ignoreUnauthorized) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
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
  // Auth
  login: (email: string, password: string, browserLanguage: AppLanguage) =>
    apiFetch<{ access_token: string; token_type: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, language: browserLanguage }),
    }),

  getMe: (browserLanguage: AppLanguage) =>
    apiFetch<User>(
      `/auth/me?${new URLSearchParams({ browser_language: browserLanguage }).toString()}`,
      { signal: AbortSignal.timeout(SESSION_REQUEST_TIMEOUT_MS) },
    ),

  register: (name: string, email: string, password: string, browserLanguage: AppLanguage) =>
    apiFetch<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, language: browserLanguage }),
    }),

  forgotPassword: (email: string) =>
    // reset_token dan note hanya terisi saat dev mode.
    apiFetch<{ message: string; reset_token?: string; note?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Tahap 1 lupa password: verifikasi OTP sebelum form password baru dibuka.
  verifyResetCode: (token: string) =>
    apiFetch<{ message: string }>('/auth/reset-password/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    apiFetch<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<{ message: string }>(
      '/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      },
      { ignoreUnauthorized: true },
    ),

  // browser_language dikirim karena backend mem-backfill kolom language di sini.
  updateProfile: (phone: string, browserLanguage: AppLanguage) =>
    apiFetch<{ user: User }>(
      `/auth/profile?${new URLSearchParams({ browser_language: browserLanguage }).toString()}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ phone }),
      },
    ),

  updateLanguage: (language: AppLanguage) =>
    apiFetch<{ language: AppLanguage }>('/auth/preferences/language', {
      method: 'PATCH',
      body: JSON.stringify({ language }),
    }),

  // Farms
  getFarms: () => apiFetch<{ items: Farm[] }>('/farms'),
  getFarmSummary: (id: string) => apiFetch<FarmSummary>(`/farms/${id}/summary`),

  createFarm: (payload: CreateFarmPayload) =>
    apiFetch<{ farm: Farm }>('/farms', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteFarm: (id: string) => apiFetch<void>(`/farms/${id}`, { method: 'DELETE' }),

  updateFarm: (id: string, payload: Partial<Farm>) =>
    apiFetch<{ farm: Farm }>(`/farms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Utils
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

  // Data
  getReadings: (nodeId: string, limit = 50) =>
    apiFetch<{ items: Reading[] }>(`/nodes/${nodeId}/readings?limit=${limit}`),

  // Kosong sampai hardware gateway mulai lapor.
  getGatewayLogs: (farmId: string, limit = 20) =>
    apiFetch<{ items: GatewayLog[] }>(`/farms/${farmId}/gateway-logs?limit=${limit}`),

  getFarmGateway: (farmId: string) =>
    apiFetch<{ gateway: FarmGateway | null }>(`/farms/${farmId}/gateway`),

  getLogs: (limit = 50) => apiFetch<{ items: IrrigationLog[] }>(`/logs?limit=${limit}`),
};
