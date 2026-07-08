// Auth feature public API — consumed by router, providers, AppLayout, DashboardBar,
// SettingsPage, dan internal auth components.

// Page entry points
export { default as LoginPage } from './LoginPage';
export { default as RegisterPage } from './RegisterPage';
export { default as ResetPasswordPage } from './ResetPasswordPage';
export { default as ChangePasswordPage } from './ChangePasswordPage';

// Auth guard components
export { RequireAuth } from './RequireAuth';
export { RedirectIfAuth } from './RedirectIfAuth';

// Context & hooks
export { AuthContext, type AuthContextValue } from './auth-context';
export { useAuth } from './auth-context';

// Query hooks
export { useUpdateProfile, useChangePassword } from './queries';
