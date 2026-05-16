import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { setLocale, type SupportedLocale } from '@nao-todo/infrastructure/locales'

export const LANGUAGE_KEY = 'USER_LANGUAGE'

const useLocaleStore = defineStore('LocaleStore', () => {
    const language = ref<SupportedLocale>('zh-CN')

    const setLanguage = (lang: SupportedLocale) => {
        language.value = lang
        setLocale(lang)
        localStorage.setItem(LANGUAGE_KEY, lang)
    }

    const loadSavedLanguage = () => {
        const saved = localStorage.getItem(LANGUAGE_KEY) as SupportedLocale | null
        if (saved && ['zh-CN', 'en-US'].includes(saved)) {
            setLanguage(saved)
        }
    }

    watch(language, (lang) => setLocale(lang), { immediate: true })

    return { language, setLanguage, loadSavedLanguage }
})

export default useLocaleStore
