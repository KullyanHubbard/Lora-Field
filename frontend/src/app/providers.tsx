import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthContext';
import { LIVE_DATA_INTERVAL_MS } from '@/lib/queryTiming';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: LIVE_DATA_INTERVAL_MS, // data dianggap fresh selama satu siklus refresh
      retry: 1, // gagal? coba ulang sekali
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
