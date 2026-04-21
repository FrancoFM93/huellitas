import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import * as Localization from 'expo-localization'
import AsyncStorage from '@react-native-async-storage/async-storage'

import es from '@/locales/es.json'
import en from '@/locales/en.json'

const LANGUAGE_KEY = 'huellitas_language'

/**
 * Loads the user's saved language preference from storage.
 * Falls back to the device locale, then to 'es'.
 */
async function getStoredLanguage(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY)
    if (stored) return stored
  } catch {}

  // Use the device's primary locale tag (e.g. 'es-AR' → 'es', 'en-US' → 'en')
  const deviceLang = Localization.getLocales()[0]?.languageCode ?? 'es'
  return ['es', 'en'].includes(deviceLang) ? deviceLang : 'es'
}

/**
 * Saves the chosen language and applies it immediately.
 * Call this from the language picker in the profile screen.
 */
export async function changeLanguage(lang: 'es' | 'en'): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang)
  await i18n.changeLanguage(lang)
}

/**
 * Initialises i18next. Called once in the root _layout.tsx.
 * Uses the stored/detected language on startup.
 */
export async function initI18n(): Promise<void> {
  const language = await getStoredLanguage()

  await i18n
    .use(initReactI18next)
    .init({
      resources: { es: { translation: es }, en: { translation: en } },
      lng: language,
      fallbackLng: 'es',
      interpolation: {
        // React already escapes values — no need for i18next to double-escape
        escapeValue: false,
      },
    })
}

export default i18n
