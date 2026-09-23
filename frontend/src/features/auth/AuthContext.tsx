import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError, UNAUTHORIZED_EVENT } from '@/lib/api';
import { clearToken, getToken, setToken, TOKEN_KEY } from '@/lib/token';
import type { User } from '@/types';
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from '@/features/auth/auth-context';
import i18n from '@/i18n/config';
import { getPreferredLanguage } from '@/i18n/language';
import {
  clearStoredUser,
  parseStoredUser,
  readStoredUser,
  USER_STORAGE_KEY,
  writeStoredUser,
} from '@/features/auth/session-storage';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUserState] = useState<User | null>(() => readStoredUser());
  const [status, setStatus] = useState<AuthStatus>(() =>
    getToken() ? 'loading' : 'guest',
  );
  const hydratedTokenRef = useRef<string | null>(null);

  const isAuthenticated = status === 'authenticated';

  const clearSession = useCallback(() => {
    clearToken();
    clearStoredUser();
    // Cache query masih memegang data kebun akun lama.
    queryClient.clear();
    setTokenState(null);
    setUserState(null);
    setStatus('guest');
  }, [queryClient]);

  const logout = clearSession;

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await api.login(email, password, getPreferredLanguage());
      queryClient.clear();
      setToken(session.access_token);
      writeStoredUser(session.user);
      hydratedTokenRef.current = session.access_token;
      setTokenState(session.access_token);
      setUserState(session.user);
      setStatus('authenticated');
    },
    [queryClient],
  );

  // Ditulis ke 'lf_user' juga supaya topbar dan tab lain ikut berubah.
  const updateUser = useCallback((next: User) => {
    writeStoredUser(next);
    setUserState(next);
  }, []);

  useEffect(() => {
    if (!token) return;

    if (hydratedTokenRef.current === token) {
      hydratedTokenRef.current = null;
      return;
    }

    let cancelled = false;

    void api
      .getMe(getPreferredLanguage())
      .then((nextUser) => {
        if (cancelled) return;
        writeStoredUser(nextUser);
        setUserState(nextUser);
        setStatus('authenticated');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // 4xx berarti token ditolak. Timeout dan 5xx belum membuktikan sesi mati,
        // jadi cache dipakai sampai request berikutnya.
        const rejectedByServer =
          error instanceof ApiError && error.status >= 400 && error.status < 500;
        const cachedUser = rejectedByServer ? null : readStoredUser();
        if (!cachedUser) {
          clearSession();
          return;
        }
        setUserState(cachedUser);
        setStatus('authenticated');
      });

    return () => {
      cancelled = true;
    };
  }, [clearSession, token]);

  // Satu-satunya tempat bahasa diselaraskan: akun pakai preferensi database,
  // guest pakai pilihan tersimpan atau deteksi browser.
  useLayoutEffect(() => {
    const language = status === 'authenticated' && user
      ? user.language
      : getPreferredLanguage();
    if (i18n.resolvedLanguage !== language) {
      void i18n.changeLanguage(language);
    }
  }, [status, user]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      // key null berarti localStorage.clear() dari tab lain.
      if (event.key === null) {
        clearSession();
        return;
      }
      if (event.key === TOKEN_KEY) {
        if (!event.newValue) {
          clearSession();
          return;
        }
        // Token baru bisa milik akun lain, jadi identitas dicek ulang dan cache dibuang.
        setToken(event.newValue);
        queryClient.clear();
        setTokenState(event.newValue);
        setStatus('loading');
        return;
      }
      if (event.key === USER_STORAGE_KEY) {
        setUserState(parseStoredUser(event.newValue));
      }
    };

    const handleUnauthorized = () => clearSession();

    window.addEventListener('storage', handleStorage);
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [clearSession, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, token, user, isAuthenticated, login, logout, updateUser }),
    [status, token, user, isAuthenticated, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
