import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthSessionLoading } from '@/features/auth/components/AuthSessionLoading';
import { useAuth } from './auth-context';

// Route wajib login. Path asli disimpan supaya bisa dikembalikan setelah login.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  // Token ada tapi identitas belum dikonfirmasi. Tanpa jeda ini, sesi yang masih
  // sah ikut terlempar ke /login.
  if (status === 'loading') return <AuthSessionLoading />;

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
