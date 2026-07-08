import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RedirectIfAuth } from '@/features/auth/RedirectIfAuth';
import { RequireAuth } from '@/features/auth/RequireAuth';

// Route-based code splitting — Leaflet (Pilih Kebun) dan chart (monitoring)
// di-load hanya saat route pertama kali dikunjungi.
const LandingPage = lazy(() => import('@/features/landing/LandingPage'));
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'));
const ChangePasswordPage = lazy(() => import('@/features/auth/ChangePasswordPage'));
const SelectFarmsPage = lazy(() => import('@/features/SelectFarms/SelectFarms'));
const MyFarmsPage = lazy(() => import('@/features/MyFarms/MyFarms'));
const AddFarmPage = lazy(() => import('@/features/farms/AddFarmPage'));
const FarmDetailPage = lazy(() => import('@/features/farms/FarmDetailPage'));
const MonitoringPage = lazy(() => import('@/features/monitoring/MonitoringPage'));
const IrrigationPage = lazy(() => import('@/features/irrigation/IrrigationPage'));
const WeatherPage = lazy(() => import('@/features/weather/WeatherPage'));
const GatewayPage = lazy(() => import('@/features/gateway/GatewayPage'));
const LogsPage = lazy(() => import('@/features/logs/LogsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

export function AppRouter() {
  return (
    <Suspense
      fallback={
        <div
          className="p-6 text-muted-foreground"
          aria-busy="true"
          aria-label="Memuat halaman..."
        />
      }
    >
      <Routes>
        {/* Landing page publik — tanpa auth guard, untuk semua pengunjung */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth routes: kalau sudah login, lempar ke Pilih Kebun */}
        <Route
          path="/login"
          element={
            <RedirectIfAuth>
              <LoginPage />
            </RedirectIfAuth>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuth>
              <RegisterPage />
            </RedirectIfAuth>
          }
        />
        <Route
          path="/reset-password"
          element={
            <RedirectIfAuth>
              <ResetPasswordPage />
            </RedirectIfAuth>
          }
        />

        {/* Tambah Kebun: full-bleed tanpa AppLayout, tetap di balik RequireAuth */}
        <Route
          path="/farms/add"
          element={
            <RequireAuth>
              <AddFarmPage />
            </RequireAuth>
          }
        />

        {/* Protected routes: dibungkus AppLayout (sidebar + topbar) di balik RequireAuth */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<SelectFarmsPage />} />
          <Route path="/farms" element={<MyFarmsPage />} />
          <Route path="/farms/:id" element={<FarmDetailPage />} />
          <Route path="/farms/:id/monitoring" element={<MonitoringPage />} />
          <Route path="/farms/:id/irrigation" element={<IrrigationPage />} />
          <Route path="/farms/:id/weather" element={<WeatherPage />} />
          <Route path="/farms/:id/gateway" element={<GatewayPage />} />
          <Route path="/farms/:id/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
