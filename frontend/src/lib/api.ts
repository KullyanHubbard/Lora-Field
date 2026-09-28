import { getToken } from './token';
import type { AppLanguage } from '@/i18n/language';
import type {
  Crop,
  CreateFarmPayload,
  Farm,
  UpdateFarmPayload,
  FarmSummary,
  FarmGateway,
  GatewayLog,
  Reading,
  IrrigationLog,
  IrrigationMode,
  Node,
  User,
} from '@/types';

const BASE = '/api';

// Tanpa ini, backend yang menggantung bikin status sesi tidak pernah selesai.
const SESSION_REQUEST_TIMEOUT_MS = 8000;

// Dipancarkan saat backend menolak token yang dipakai. AuthProvider yang menangani.
export const UNAUTHORIZED_EVENT = 'lf:unauthorized';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// detail dari FastAPI: string untuk HTTPException, array {msg} untuk error validasi 422.
function detailMessage(detail: unknown): string | undefined {
  if (typeof detail === 'string') return detail;
  if (!Array.isArray(detail)) return undefined;
  const messages = detail
    .map((item: { msg?: unknown } | null) => item?.msg)
    .filter((msg): msg is string => typeof msg === 'string');
  return messages.length ? messages.join(' ') : undefined;
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
      message = detailMessage(body.detail) ?? body.message ?? message;
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

  // Respons sama untuk email baru dan email terdaftar, supaya tidak membocorkan akun.
  // verification_token dan note hanya terisi saat dev mode.
  register: (name: string, email: string, password: string, browserLanguage: AppLanguage) =>
    apiFetch<{ message: string; verification_token?: string; note?: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, language: browserLanguage }),
    }),

  // Tahap 2 daftar: nama dan password dikirim lagi karena baru disimpan setelah kode benar.
  verifyRegistration: (
    name: string,
    email: string,
    password: string,
    token: string,
    browserLanguage: AppLanguage,
  ) =>
    apiFetch<{ message: string }>('/auth/register/verify', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, language: browserLanguage, token }),
    }),

  forgotPassword: (email: string) =>
    // reset_token dan note hanya terisi saat dev mode.
    apiFetch<{ message: string; reset_token?: string; note?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Tahap 1 lupa password: verifikasi OTP sebelum form password baru dibuka.
  verifyResetCode: (email: string, token: string) =>
    apiFetch<{ message: string }>('/auth/reset-password/verify', {
      method: 'POST',
      body: JSON.stringify({ email, token }),
    }),

  resetPassword: (email: string, token: string, newPassword: string) =>
    apiFetch<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, token, new_password: newPassword }),
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

  updateFarm: (id: string, payload: UpdateFarmPayload) =>
    apiFetch<{ farm: Farm }>(`/farms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Kendali valve
  setIrrigationMode: (farmId: string, mode: IrrigationMode) =>
    apiFetch<{ farm: Farm }>(`/farms/${farmId}/irrigation-mode`, {
      method: 'PATCH',
      body: JSON.stringify({ mode }),
    }),

  startIrrigation: (farmId: string) =>
    apiFetch<{ nodes: Node[] }>(`/farms/${farmId}/irrigation/start`, { method: 'POST' }),

  stopIrrigation: (farmId: string) =>
    apiFetch<{ nodes: Node[] }>(`/farms/${farmId}/irrigation/stop`, { method: 'POST' }),

  setValve: (nodeId: string, open: boolean) =>
    apiFetch<{ node: Node }>(`/nodes/${nodeId}/valve`, {
      method: 'PATCH',
      body: JSON.stringify({ open }),
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
  // Semua reading dalam N jam sebelum reading terbaru node, sehingga node yang sudah lama
  // diam tetap menampilkan data terakhirnya.
  getReadings: (nodeId: string, hours: number) =>
    apiFetch<{ items: Reading[] }>(`/nodes/${nodeId}/readings?hours=${hours}`),

  // Kosong sampai hardware gateway mulai lapor.
  getGatewayLogs: (farmId: string, limit: number) =>
    apiFetch<{ items: GatewayLog[] }>(`/farms/${farmId}/gateway-logs?limit=${limit}`),

  getFarmGateway: (farmId: string) =>
    apiFetch<{ gateway: FarmGateway | null }>(`/farms/${farmId}/gateway`),

  getLogs: ({
    farmId,
    limit,
    start,
    end,
  }: {
    farmId: string;
    limit: number;
    start?: string;
    end?: string;
  }) => {
    const query = new URLSearchParams({ farm_id: farmId, limit: String(limit) });
    if (start) query.set('start', start);
    if (end) query.set('end', end);
    return apiFetch<{ items: IrrigationLog[] }>(`/logs?${query.toString()}`);
  },
};
