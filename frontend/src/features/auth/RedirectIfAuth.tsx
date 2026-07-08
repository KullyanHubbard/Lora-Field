import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './auth-context';

/**
 * Bungkus route auth (login/register/reset). Kalau sudah login,
 * langsung redirect ke dashboard supaya user tidak buang waktu di form login.
 */
export function RedirectIfAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
