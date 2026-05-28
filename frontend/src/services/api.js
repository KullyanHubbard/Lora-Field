/**
 * API client untuk backend LoraField.
 *
 * Dev: pakai relative '/api/...' supaya Vite proxy ke 127.0.0.1:8000.
 * Prod (build): kalau hostname bukan localhost, asumsikan same-origin
 * dengan backend (URL = window.location.origin). User bisa override
 * dengan localStorage.lf_api_base.
 */

const STORAGE_KEYS = {
  TOKEN: 'lf_access_token',
  TOKEN_TYPE: 'lf_token_type',
  USER: 'lf_user',
  API_BASE: 'lf_api_base',
};

export function getApiBase() {
  try {
    const manual = localStorage.getItem(STORAGE_KEYS.API_BASE);
    if (manual) return manual;
  } catch (_) {}
  if (typeof window === 'undefined') return '';
  if (window.location.port === '8000') return window.location.origin;
  const h = window.location.hostname;
  if (h && h !== 'localhost' && h !== '127.0.0.1') return window.location.origin;
  // Dev mode (vite di 5173) → pakai relative agar ter-proxy
  return '';
}

export function getToken() {
  try {
    return localStorage.getItem(STORAGE_KEYS.TOKEN) || '';
  } catch (_) {
    return '';
  }
}

export function saveSession({ access_token, token_type, user }) {
  try {
    if (access_token) localStorage.setItem(STORAGE_KEYS.TOKEN, access_token);
    if (token_type) localStorage.setItem(STORAGE_KEYS.TOKEN_TYPE, token_type);
    if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  } catch (_) {}
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.TOKEN_TYPE);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem('lf_auth_demo');
    localStorage.removeItem('lf_selected_farm');
    localStorage.removeItem('lf_threshold_lower');
    localStorage.removeItem('lf_threshold_upper');
    localStorage.removeItem('lf_valve_state');
  } catch (_) {}
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

/**
 * Wrapper fetch yang otomatis:
 * - Inject Authorization header
 * - Parse JSON body (toleran kalau body kosong / non-JSON)
 * - Return { ok, status, data }
 */
export async function apiFetch(path, options = {}) {
  const base = getApiBase();
  const url = `${base}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkError) {
    return { ok: false, status: 0, data: { detail: 'Tidak bisa terhubung ke backend.' } };
  }
  let data = {};
  try {
    const raw = await response.text();
    data = raw ? JSON.parse(raw) : {};
  } catch (_) {
    data = {};
  }
  return { ok: response.ok, status: response.status, data };
}

// -----------------------------------------------------------
// Endpoint-spesifik
// -----------------------------------------------------------

export function login(email, password) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(name, email, password) {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export function forgotPassword(email) {
  return apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token, newPassword) {
  return apiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

export function resetPasswordVerify(token) {
  return apiFetch('/api/auth/reset-password/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function changePassword(currentPassword, newPassword) {
  return apiFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export function getMe() {
  return apiFetch('/api/auth/me');
}

export function updateProfile(phone) {
  return apiFetch('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ phone }),
  });
}

// -----------------------------------------------------------
// Farms
// -----------------------------------------------------------

export function listFarms() {
  return apiFetch('/api/farms');
}

export function getFarm(farmId) {
  return apiFetch(`/api/farms/${encodeURIComponent(farmId)}`);
}

export function getFarmSummary(farmId) {
  return apiFetch(`/api/farms/${encodeURIComponent(farmId)}/summary`);
}

export function deleteFarm(farmId) {
  return apiFetch(`/api/farms/${encodeURIComponent(farmId)}`, { method: 'DELETE' });
}

export function createFarm(payload) {
  return apiFetch('/api/farms', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listCrops() {
  return apiFetch('/api/crops');
}

export function resolveAdm4(lat, lon, q = '') {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon), q });
  return apiFetch(`/api/utils/resolve-adm4?${params.toString()}`);
}

// -----------------------------------------------------------
// Nodes & readings
// -----------------------------------------------------------

export function listNodes(farmId) {
  const qs = farmId ? `?farm_id=${encodeURIComponent(farmId)}` : '';
  return apiFetch(`/api/nodes${qs}`);
}

export function listNodeReadings(nodeId, limit = 20) {
  return apiFetch(
    `/api/nodes/${encodeURIComponent(nodeId)}/readings?limit=${limit}`,
  );
}

// -----------------------------------------------------------
// Logs
// -----------------------------------------------------------

export function listLogs(limit = 50) {
  return apiFetch(`/api/logs?limit=${limit}`);
}
