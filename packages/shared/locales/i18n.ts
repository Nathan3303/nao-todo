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
    messages: messages as never
})

export const setLocale = (locale: SupportedLocale) => {
    i18n.global.locale.value = locale
}

export const getLocale = () => {
    return i18n.global.locale
}

// vue-i18n 的 t 类型带有大量重载与深层泛型，直接访问 i18n.global.t 会触发
// TS2589（类型实例化过深）。先把实例断言为最小结构，再取 t。
const globalT = (
    i18n as unknown as {
        global: { t: (key: LocaleKey, params?: Record<string, string | number>) => string }
    }
).global.t

// 兼容层：保持原有的 t 函数 API 不变
export const t = (key: LocaleKey, params?: Record<string, string | number>) => {
    return globalT(key, params)
}

// 导出 locale 计算属性保持兼容
export const locale = i18n.global.locale