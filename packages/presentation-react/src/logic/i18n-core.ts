import type { LocaleKey, SupportedLocale } from '@nao-todo/shared/locales/types'
import { messages } from '@nao-todo/shared/locales/messages'
import { LANGUAGE_KEY } from '@nao-todo/domain-identity/src/domain/constants'
import { getStorageItem, setStorageItem } from './storage-core'

/**
 * 默认语言
 */
export const DEFAULT_LOCALE: SupportedLocale = 'zh-CN'

/**
 * 文本插值
 * @description 支持 {name} 形式的参数占位（与 vue-i18n 的命名插值语法一致）
 * @param message 原文
 * @param params 插值参数
 * @returns 插值结果
 */
const interpolate = (message: string, params?: Record<string, string | number>): string => {
    if (params === undefined) return message
    return message.replace(/\{(\w+)\}/g, (match, key) => {
        const value = params[key]
        return value !== undefined ? String(value) : match
    })
}

/**
 * 翻译
 * @description 框架无关的 t 函数：key → 当前语言文案；缺失时 fallback zh-CN，再缺失时返回 key 本身
 * @param locale 语言
 * @param key 文案键
 * @param params 插值参数
 * @returns 翻译结果
 */
export const translate = (
    locale: SupportedLocale,
    key: LocaleKey,
    params?: Record<string, string | number>
): string => {
    const table = messages[locale] ?? messages[DEFAULT_LOCALE]
    const message = table?.[key]
    if (message === undefined) {
        const fallback = messages[DEFAULT_LOCALE]?.[key]
        return fallback !== undefined ? interpolate(fallback, params) : key
    }
    return interpolate(message, params)
}

/**
 * 读取已保存的语言偏好
 * @returns 语言偏好（无保存值时返回默认语言）
 */
export const loadSavedLocale = async (): Promise<SupportedLocale> => {
    const saved = await getStorageItem(LANGUAGE_KEY)
    return saved === 'zh-CN' || saved === 'en-US' ? saved : DEFAULT_LOCALE
}

/**
 * 保存语言偏好
 * @param locale 语言
 */
export const saveLocale = async (locale: SupportedLocale): Promise<void> => {
    await setStorageItem(LANGUAGE_KEY, locale)
}