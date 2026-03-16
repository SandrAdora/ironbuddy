import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from '../public/locales/en/translation.json';
import de from '../public/locales/de/translation.json';
import fr from '../public/locales/fr/translation.json';
import es from '../public/locales/es/translation.json';
import hu from '../public/locales/hu/translation.json';

export const SUPPORTED_LANGUAGES = ['en', 'de', 'fr', 'es', 'hu'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, de: { translation: de }, fr: { translation: fr }, es: { translation: es }, hu: { translation: hu } },
    supportedLngs: [...SUPPORTED_LANGUAGES],
    fallbackLng: 'en',
    defaultNS: 'translation',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'ironbuddy_language',
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18n;
