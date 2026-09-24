const SUPPORTED_LANGUAGES = ['id', 'en'] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

function detectBrowserLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') return 'en';
  return navigator.language.toLowerCase().startsWith('id') ? 'id' : 'en';
}

const LEGACY_LANGUAGE_KEY = 'lf_lang';

// Pilihan bahasa sebelum preferensi pindah ke backend. Dibaca sekali saat app
// start lalu dibuang, supaya user lama tidak ter-reset ke bahasa browser.
function takeLegacyLanguage(): AppLanguage | null {
  try {
    const value = localStorage.getItem(LEGACY_LANGUAGE_KEY);
    localStorage.removeItem(LEGACY_LANGUAGE_KEY);
    return isAppLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

const preferred: AppLanguage = takeLegacyLanguage() ?? detectBrowserLanguage();

export function getPreferredLanguage(): AppLanguage {
  return preferred;
}
