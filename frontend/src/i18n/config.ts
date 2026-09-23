import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import id from './locales/id.json';
import en from './locales/en.json';
import { getPreferredLanguage } from './language';

const initialLanguage = getPreferredLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    id: { translation: id },
    en: { translation: en },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

function syncDocumentLanguage(language: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = language;
}

syncDocumentLanguage(initialLanguage);
i18n.on('languageChanged', syncDocumentLanguage);

export default i18n;
