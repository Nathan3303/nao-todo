import { t } from '@nao-todo/shared/locales'
import type { Command, Platform } from '@nao-todo/shared/commands'
import { formatKeyHint } from './key-hint'

/**
 * 命令的展示文案（单一来源）
 * @description 命令面板与快捷键帮助**只**认注册表里的 `Command`：文案优先取 `i18n` 键
 *              （语言切换后重新渲染即生效），缺省回落字面量，再缺省回落 id。
 *              ⛔ 禁止在面板/帮助里另写一份命令或按键清单。
 */

/** 名称（缺失时回落 id —— 应用内注册的命令一律带 `i18n.label`，由用例守护） */
export const commandLabelOf = (command: Command): string => {
    if (command.i18n?.label) return t(command.i18n.label)
    return command.label ?? command.id
}

/** 描述（可缺省） */
export const commandDescriptionOf = (command: Command): string => {
    if (command.i18n?.description) return t(command.i18n.description)
    return command.description ?? ''
}

/** 分组名（无分组的命令归「其他」） */
export const commandGroupOf = (command: Command): string => {
    if (command.i18n?.group) return t(command.i18n.group)
    return command.group ?? t('commands.group.other')
}

/**
 * 键位提示（键盘绑定优先，其次非键盘手势）
 * @param fallbackWheelLabel `wheel` 手势的本地化词（调用方传 `t('commands.key.wheel')`，
 *        保持本模块只依赖 `t` 的键集合而不固化词表）
 */
export const commandKeyHintOf = (
    command: Command,
    platform: Platform,
    fallbackWheelLabel: string
): string =>
    formatKeyHint(command.keyboard?.keys ?? command.gesture, {
        platform,
        wheelLabel: fallbackWheelLabel
    })

/** 是否有可展示的键位提示（帮助面板只列「有键位/手势」的命令） */
export const commandHasKeyHint = (command: Command): boolean =>
    command.keyboard?.keys != null || command.gesture != null