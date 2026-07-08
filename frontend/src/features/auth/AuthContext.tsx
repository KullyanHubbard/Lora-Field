import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { clearToken, getToken, setToken } from '@/lib/token';
import type { User } from '@/types';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context';

// Token diakses lewat lib/token.ts. User dipersist terpisah di localStorage
// ('lf_user') seperti versi lama — ini bukan token, jadi boleh akses langsung.
const USER_KEY = 'lf_user';

function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUserState] = useState<User | null>(() => getStoredUser());

  const isAuthenticated = Boolean(token);

  const login = useCallback(async (email: string, password: string) => {
    const session = await api.login(email, password);
    setToken(session.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    setTokenState(session.access_token);
    setUserState(session.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(USER_KEY);
    setTokenState(null);
    setUserState(null);
  }, []);

  // Update user object (mis. setelah edit profil). Sync ke state + localStorage
  // ('lf_user') supaya topbar dan tab lain ikut berubah.
  const updateUser = useCallback((next: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    setUserState(next);
  }, []);

  // Sync antar tab: kalau user logout di tab lain, propagate ke tab ini.
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === 'lf_access_token') {
        setTokenState(event.newValue);
      }
      if (event.key === USER_KEY) {
        try {
          setUserState(event.newValue ? (JSON.parse(event.newValue) as User) : null);
        } catch {
          setUserState(null);
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, isAuthenticated, login, logout, updateUser }),
    [token, user, isAuthenticated, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
