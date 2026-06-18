import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { clearToken, getToken, setToken } from '@/lib/token';
import type { User } from '@/types';

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

interface AuthContextValue {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

  const value = useMemo(
    () => ({ token, user, isAuthenticated, login, logout }),
    [token, user, isAuthenticated, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}
