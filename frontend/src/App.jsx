import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RedirectIfAuth } from './components/RedirectIfAuth';
import { RequireAuth } from './components/RequireAuth';

// Route-based code splitting — Leaflet (DashboardPage) dan Chart.js (MonitoringPage)
// di-load hanya saat route pertama kali dikunjungi.
const AddFarmPage = lazy(() => import('./pages/AddFarmPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const FarmDetailPage = lazy(() => import('./pages/FarmDetailPage'));
const FarmsPage = lazy(() => import('./pages/FarmsPage'));
const GatewayPage = lazy(() => import('./pages/GatewayPage'));
const IrrigationPage = lazy(() => import('./pages/IrrigationPage'));
const LogsPage = lazy(() => import('./pages/LogsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage'));
const NodesPage = lazy(() => import('./pages/NodesPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const WeatherPage = lazy(() => import('./pages/WeatherPage'));

function App() {
  return (
    <Suspense fallback={<div className="page-loading" aria-busy="true" aria-label="Memuat halaman..." />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Auth routes: kalau sudah login, lempar ke dashboard */}
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

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/farms"
          element={
            <RequireAuth>
              <FarmsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/farms/add"
          element={
            <RequireAuth>
              <AddFarmPage />
            </RequireAuth>
          }
        />
        <Route
          path="/farms/:id"
          element={
            <RequireAuth>
              <FarmDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/farms/:id/monitoring"
          element={
            <RequireAuth>
              <MonitoringPage />
            </RequireAuth>
          }
        />
        <Route
          path="/farms/:id/irrigation"
          element={
            <RequireAuth>
              <IrrigationPage />
            </RequireAuth>
          }
        />
        <Route
          path="/farms/:id/weather"
          element={
            <RequireAuth>
              <WeatherPage />
            </RequireAuth>
          }
        />
        <Route
          path="/farms/:id/gateway"
          element={
            <RequireAuth>
              <GatewayPage />
            </RequireAuth>
          }
        />
        <Route
          path="/farms/:id/nodes"
          element={
            <RequireAuth>
              <NodesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/farms/:id/logs"
          element={
            <RequireAuth>
              <LogsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/change-password"
          element={
            <RequireAuth>
              <ChangePasswordPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
