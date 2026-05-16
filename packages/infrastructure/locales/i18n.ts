import { ref, computed } from 'vue'
import type { LocaleKey } from './types'
import zhCN from './zh-CN'
import enUS from './en-US'

export type SupportedLocale = 'zh-CN' | 'en-US'

const messages: Record<SupportedLocale, Record<LocaleKey, string>> = {
    'zh-CN': zhCN,
    'en-US': enUS,
}

const currentLocale = ref<SupportedLocale>('zh-CN')

export const locale = computed(() => currentLocale.value)

export const setLocale = (loc: SupportedLocale) => {
    currentLocale.value = loc
}

export const t = (key: LocaleKey, params?: Record<string, string | number>): string => {
    const msg = messages[currentLocale.value][key]
    if (msg === undefined) {
        console.warn(`[i18n] Missing translation key: ${key}`)
        return key
    }
    if (!params) return msg
    return msg.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
}
