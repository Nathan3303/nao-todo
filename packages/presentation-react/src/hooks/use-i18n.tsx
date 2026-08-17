import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { LocaleKey, SupportedLocale } from '@nao-todo/shared/locales/types'
import { DEFAULT_LOCALE, loadSavedLocale, saveLocale, translate } from '../logic/i18n-core'

/**
 * i18n 上下文值
 */
export type I18nContextValue = {
    locale: SupportedLocale
    setLocale: (locale: SupportedLocale) => void
    t: (key: LocaleKey, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

/**
 * i18n Provider
 * @description 挂载时从持久化存储读取语言偏好；setLocale 更新状态并保存偏好
 */
export const I18nProvider = ({ children }: { children: ReactNode }) => {
    const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE)

    useEffect(() => {
        void loadSavedLocale().then((saved) => setLocaleState(saved))
    }, [])

    const setLocale = useCallback((next: SupportedLocale) => {
        setLocaleState(next)
        void saveLocale(next)
    }, [])

    const t = useCallback(
        (key: LocaleKey, params?: Record<string, string | number>) =>
            translate(locale, key, params),
        [locale]
    )

    const value = useMemo<I18nContextValue>(
        () => ({ locale, setLocale, t }),
        [locale, setLocale, t]
    )

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/**
 * 使用 i18n
 * @description 需在 I18nProvider 内使用
 * @returns { locale, setLocale, t }
 */
export const useI18n = (): I18nContextValue => {
    const context = useContext(I18nContext)
    if (context === null) {
        throw new Error('useI18n must be used within I18nProvider')
    }
    return context
}