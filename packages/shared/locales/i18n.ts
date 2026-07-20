import { createI18n } from 'vue-i18n'
import type { LocaleMessages, LocaleKey } from './types'
import zhCN from './zh-CN'
import enUS from './en-US'

export type SupportedLocale = 'zh-CN' | 'en-US'

const messages: Record<SupportedLocale, LocaleMessages> = {
    'zh-CN': zhCN,
    'en-US': enUS
}

export const i18n = createI18n({
    legacy: false,
    locale: 'zh-CN',
    fallbackLocale: 'zh-CN',
    messages
})

export const setLocale = (locale: SupportedLocale) => {
    i18n.global.locale.value = locale
}

export const getLocale = () => {
    return i18n.global.locale.value
}

// 兼容层：保持原有的 t 函数 API 不变
export const t = (key: LocaleKey, params?: Record<string, string | number>) => {
    return i18n.global.t(key, params)
}

// 导出 locale 计算属性保持兼容
export const locale = i18n.global.locale

