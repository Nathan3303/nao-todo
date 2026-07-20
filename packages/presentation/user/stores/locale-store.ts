import { defineStore } from 'pinia'
import { setLocale, getLocale, type SupportedLocale } from '@nao-todo/shared'
import { computed } from 'vue'
import { LANGUAGE_KEY } from '@nao-todo/domain/user'

export const useLocaleStore = defineStore('LocaleStore', () => {
    // 当前语言
    const language = computed<SupportedLocale>(() => getLocale() as SupportedLocale)

    /**
     * 设置当前语言
     * @param lang 语言
     */
    const setLanguage = (lang: SupportedLocale) => {
        setLocale(lang)
        localStorage.setItem(LANGUAGE_KEY, lang)
    }

    /**
     * 加载保存的语言
     */
    const loadSavedLanguage = () => {
        const saved = localStorage.getItem(LANGUAGE_KEY) as SupportedLocale | null
        if (saved && ['zh-CN', 'en-US'].includes(saved)) {
            setLanguage(saved)
        }
    }

    // @returns
    return {
        language,
        setLanguage,
        loadSavedLanguage
    }
})
