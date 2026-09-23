import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthSessionLoading } from '@/features/auth/components/AuthSessionLoading';
import { useAuth } from './auth-context';

// Route auth. Yang sudah login langsung dilempar ke dashboard.
export function RedirectIfAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  // Tanpa ini form login sempat berkedip sebelum redirect.
  if (status === 'loading') return <AuthSessionLoading />;

  if (status === 'authenticated') {
    return <Navigate to="/select-farms" replace />;
  }
  return children;
}
