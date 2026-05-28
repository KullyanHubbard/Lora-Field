import { useEffect, useState } from 'react';

const THEME_KEY = 'lf_theme';

function readSavedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch (_) {
    return 'dark';
  }
}

function applyTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (_) {}
}

/**
 * Toggle tema light/dark. Versi sederhana dari `initThemeSwitcher` di
 * main.js — tanpa View Transition animation, hasil visual sama karena
 * CSS [data-theme] yang sama.
 */
export function ThemeSwitcher() {
  const [theme, setTheme] = useState(() => readSavedTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="theme-switcher" role="group" aria-label="Pilih tema tampilan" data-active={theme}>
      <button
        className={`theme-option${theme === 'light' ? ' active' : ''}`}
        type="button"
        data-theme-value="light"
        aria-pressed={theme === 'light'}
        aria-label="Tema terang"
        title="Terang"
        onClick={() => setTheme('light')}
      >
        <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
        <span>Terang</span>
      </button>
      <button
        className={`theme-option${theme === 'dark' ? ' active' : ''}`}
        type="button"
        data-theme-value="dark"
        aria-pressed={theme === 'dark'}
        aria-label="Tema gelap"
        title="Gelap"
        onClick={() => setTheme('dark')}
      >
        <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.99 12.38A8.5 8.5 0 1 1 11.62 3.01 6.5 6.5 0 0 0 20.99 12.38Z" />
        </svg>
        <span>Gelap</span>
      </button>
    </div>
  );
}
