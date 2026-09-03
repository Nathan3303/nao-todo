import type { LocaleMessages, SupportedLocale } from './types'
import zhCN from './zh-CN'
import enUS from './en-US'

/**
 * 语言消息数据
 * @description 框架无关的纯翻译数据（不依赖 vue-i18n / Vue 运行时），
 *              供 Lynx（ReactLynx）等非 Vue 端复用；Web/Desktop 端仍走 vue-i18n 实例。
 */
export const messages: Record<SupportedLocale, LocaleMessages> = {
    'zh-CN': zhCN,
    'en-US': enUS
}