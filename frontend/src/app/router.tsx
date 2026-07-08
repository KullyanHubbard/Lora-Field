import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RedirectIfAuth, RequireAuth } from '@/features/auth';

// Route-based code splitting — Leaflet (Pilih Kebun) dan chart (monitoring)
// di-load hanya saat route pertama kali dikunjungi.
const LandingPage = lazy(() => import('@/features/landing').then(m => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('@/features/auth').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/features/auth').then(m => ({ default: m.RegisterPage })));
const ResetPasswordPage = lazy(() => import('@/features/auth').then(m => ({ default: m.ResetPasswordPage })));
const ChangePasswordPage = lazy(() => import('@/features/auth').then(m => ({ default: m.ChangePasswordPage })));
const SelectFarmsPage = lazy(() => import('@/features/selectFarms').then(m => ({ default: m.SelectFarmsPage })));
const MyFarmsPage = lazy(() => import('@/features/myFarms').then(m => ({ default: m.MyFarmsPage })));
const AddFarmPage = lazy(() => import('@/features/addFarm').then(m => ({ default: m.AddFarmPage })));
const DashboardPage = lazy(() => import('@/features/dashboard').then(m => ({ default: m.DashboardPage })));
const MonitoringPage = lazy(() => import('@/features/monitoring').then(m => ({ default: m.MonitoringPage })));
const IrrigationPage = lazy(() => import('@/features/irrigation').then(m => ({ default: m.IrrigationPage })));
const WeatherPage = lazy(() => import('@/features/weather').then(m => ({ default: m.WeatherPage })));
const GatewayPage = lazy(() => import('@/features/gateway').then(m => ({ default: m.GatewayPage })));
const LogsPage = lazy(() => import('@/features/logs').then(m => ({ default: m.LogsPage })));
const SettingsPage = lazy(() => import('@/features/settings').then(m => ({ default: m.SettingsPage })));

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
          path="/addFarm"
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
          <Route path="/select-farms" element={<SelectFarmsPage />} />
          <Route path="/my-farms" element={<MyFarmsPage />} />
          <Route path="/farms/:id" element={<DashboardPage />} />
          <Route path="/farms/:id/monitoring" element={<MonitoringPage />} />
          <Route path="/farms/:id/irrigation" element={<IrrigationPage />} />
          <Route path="/farms/:id/weather" element={<WeatherPage />} />
          <Route path="/farms/:id/gateway" element={<GatewayPage />} />
          <Route path="/farms/:id/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/select-farms" replace />} />
      </Routes>
    </Suspense>
  );
}
