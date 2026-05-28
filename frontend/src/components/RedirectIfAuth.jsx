import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Bungkus route auth (login/register/reset). Kalau sudah login,
 * langsung redirect ke dashboard supaya user tidak buang waktu di form login.
 */
export function RedirectIfAuth({ children }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
