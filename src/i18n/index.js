import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import enUS from './locales/en-US.json';
import esMX from './locales/es-MX.json';
import { getKey, setKey, PREF_KEYS } from '../services/storage/prefs';

const resources = {
  'en-US': { translation: enUS },
  'es-MX': { translation: esMX },
};

export const LANGUAGES = [
  { key: 'en-US', label: 'English' },
  { key: 'es-MX', label: 'Español' },
];

const pickInitialLanguage = async () => {
  const stored = await getKey(PREF_KEYS.LNG_PREFERENCE);
  if (stored) return stored;
  const device = getLocales?.()[0]?.languageCode;
  return device === 'es' ? 'es-MX' : 'en-US';
};

export const initI18n = async () => {
  const lng = await pickInitialLanguage();
  await i18next.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en-US',
    interpolation: { escapeValue: false },
  });
  return i18next;
};

export const changeLanguage = async (lng) => {
  await i18next.changeLanguage(lng);
  await setKey(PREF_KEYS.LNG_PREFERENCE, lng);
};

export default i18next;
