import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function displayNameOf(user) {
  const name = (user?.name || '').trim();
  if (name) return name;
  const email = (user?.email || '').trim();
  if (email) return email.split('@')[0];
  return 'Pengguna';
}

const PersonIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M20 21a8 8 0 0 0-16 0" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

/**
 * Pill user untuk auth-page (login/register/reset) di pojok kanan atas.
 * Hanya tampil kalau user sudah login (jarang terjadi karena auth pages
 * pakai RedirectIfAuth, tapi guard tetap dipasang).
 */
export function AuthUserPill() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;
  const name = displayNameOf(user);
  return (
    <Link className="auth-user-pill" to="/settings" aria-label={`Akun ${name}`}>
      <PersonIcon />
      <span>{name}</span>
    </Link>
  );
}

/**
 * Pill user untuk topbar dashboard (sudah login).
 */
export function TopbarUserPill() {
  const { user } = useAuth();
  const name = displayNameOf(user);
  return (
    <Link className="topbar-user" id="topbar-user" to="/settings" aria-label={`Akun ${name}`}>
      <PersonIcon className="topbar-user-icon" />
      <span>{name}</span>
    </Link>
  );
}
