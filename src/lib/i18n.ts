import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: 'en', fallbackLng: 'en', interpolation: { escapeValue: false },
  react: { useSuspense: false },
});
/** English and Latin American Spanish both launch in beta (Blueprint v4). */
export const SPANISH_ENABLED: boolean = true;
if (!SPANISH_ENABLED) i18n.on('languageChanged', l => { if (l !== 'en') void i18n.changeLanguage('en'); });
export default i18n;

/** Switch to the saved (or browser) language. Call only after the current page has hydrated. */
export function applySavedLanguage() {
  if (!SPANISH_ENABLED) return;
  const language = localStorage.getItem('gatherwell-language') ?? (navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en');
  if (i18n.resolvedLanguage !== language) void i18n.changeLanguage(language);
}

/** Marketing pages render on the server in English, so the language switch waits for their own hydration. */
export function isServerRenderedMarketing(pathname: string) {
  const p = pathname.replace(/\/$/, '') || '/';
  return ['/', '/hosts', '/pricing', '/studios', '/discover', '/about', '/careers', '/faq'].includes(p) || /^\/(c|e|h|l|t|i|r)\//.test(p);
}
