export const TOKEN_KEY = 'lf_access_token';

// Cadangan saat localStorage diblokir (private mode). Di luar itu localStorage
// tetap satu-satunya sumber, supaya token yang sudah dihapus tidak hidup lagi.
let memoryToken: string | null = null;

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return memoryToken;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    memoryToken = null;
  } catch {
    memoryToken = token;
  }
}

export function clearToken(): void {
  memoryToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage diblokir, tidak ada sisa yang perlu dibersihkan.
  }
}
