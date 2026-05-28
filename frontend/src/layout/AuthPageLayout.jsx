import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { AuthUserPill } from '../components/UserPill';
import { useBodyClass } from '../hooks/useBodyClass';

/**
 * Wrapper untuk halaman auth (login/register/reset/change-password).
 * Render brand bar di atas, theme switcher di pojok kanan atas, dan
 * apply class `auth-page` ke body untuk background gradient.
 */
export function AuthPageLayout({ children, showBrandBar = true }) {
  useBodyClass('auth-page');

  return (
    <>
      {showBrandBar ? (
        <header className="auth-brand-bar" aria-label="LoraField branding">
          <div className="auth-brand-link">
            <img src="/static/img/logo.svg" className="auth-brand-logo" alt="" />
            <span className="auth-brand-name">LoraField</span>
          </div>
          <div className="auth-theme-slot" aria-label="Pengaturan tema">
            <ThemeSwitcher />
          </div>
        </header>
      ) : (
        <div className="page-topright" aria-label="Kontrol halaman">
          <div className="auth-theme-slot" aria-label="Pengaturan tema">
            <ThemeSwitcher />
          </div>
          <div className="auth-user-slot">
            <AuthUserPill />
          </div>
        </div>
      )}
      {children}
    </>
  );
}
