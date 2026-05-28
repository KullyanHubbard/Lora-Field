import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Bungkus route yang HARUS login. Kalau belum login, lempar ke /login.
 * Simpan path asli di state supaya bisa diarahkan balik setelah login.
 */
export function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
