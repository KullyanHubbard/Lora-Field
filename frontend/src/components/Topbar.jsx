import { Clock } from './Clock';
import { FarmSwitcher } from './FarmSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { TopbarUserPill } from './UserPill';

export function Topbar({ onMenuToggle }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="mobile-toggle"
          id="sidebar-toggle"
          type="button"
          aria-label="Buka navigasi"
          aria-controls="sidebar"
          onClick={onMenuToggle}
        >
          <i className="fas fa-bars" aria-hidden="true" />
        </button>
        <FarmSwitcher />
      </div>
      <div className="topbar-right">
        <Clock />
        <ThemeSwitcher />
        <TopbarUserPill />
      </div>
    </header>
  );
}
