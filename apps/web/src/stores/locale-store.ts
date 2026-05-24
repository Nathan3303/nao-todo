import { defineStore } from 'pinia'
import { setLocale, getLocale, type SupportedLocale } from '@nao-todo/infrastructure/locales'
import { computed, watch } from 'vue'

export const LANGUAGE_KEY = 'USER_LANGUAGE'

const useLocaleStore = defineStore('LocaleStore', () => {
  const language = computed<SupportedLocale>(() => getLocale() as SupportedLocale)

  const setLanguage = (lang: SupportedLocale) => {
    setLocale(lang)
    localStorage.setItem(LANGUAGE_KEY, lang)
  }

  const loadSavedLanguage = () => {
    const saved = localStorage.getItem(LANGUAGE_KEY) as SupportedLocale | null
    if (saved && ['zh-CN', 'en-US'].includes(saved)) {
      setLanguage(saved)
    }
  }

  return { language, setLanguage, loadSavedLanguage }
})

export default useLocaleStore
