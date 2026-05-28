import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearSession, getStoredUser, getToken, saveSession } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getToken());
  const [user, setUser] = useState(() => getStoredUser());

  const isAuthenticated = Boolean(token);

  const signIn = useCallback((session) => {
    saveSession(session);
    setToken(session.access_token || '');
    setUser(session.user || null);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setToken('');
    setUser(null);
  }, []);

  // Sync antar tab: kalau user logout di tab lain, propagate ke tab ini.
  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'lf_access_token') {
        setToken(event.newValue || '');
      }
      if (event.key === 'lf_user') {
        try {
          setUser(event.newValue ? JSON.parse(event.newValue) : null);
        } catch (_) {
          setUser(null);
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const value = useMemo(
    () => ({ token, user, isAuthenticated, signIn, signOut }),
    [token, user, isAuthenticated, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}
