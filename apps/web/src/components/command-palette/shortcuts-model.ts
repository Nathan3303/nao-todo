import type { Command, Platform } from '@nao-todo/shared/commands'
import {
    commandGroupOf,
    commandHasKeyHint,
    commandKeyHintOf,
    commandLabelOf
} from './command-display'
import { groupInOrder } from './palette-model'

/**
 * 快捷键帮助的纯模型
 * @description 内容**全部**由注册表快照派生（`registry.getAll()`）：
 *              只列**真的有键位/手势**的命令（占位、不可达命令不进注册表 ⇒ 自然不出现），
 *              分组顺序 = 首次出现顺序，组内顺序 = 注册顺序。
 */

export interface ShortcutRow {
    id: string
    label: string
    /** 已格式化的键位提示（如 `⌘+K`） */
    hint: string
}

export interface ShortcutGroup {
    name: string
    rows: ShortcutRow[]
}

export interface ShortcutSourceHooks {
    platform: Platform
    wheelLabel: string
}

export const buildShortcutGroups = (
    commands: readonly Command[],
    hooks: ShortcutSourceHooks
): ShortcutGroup[] =>
    groupInOrder(commands.filter(commandHasKeyHint), (command) => commandGroupOf(command)).map(
        (group) => ({
            name: group.name,
            rows: group.items.map((command) => ({
                id: command.id,
                label: commandLabelOf(command),
                hint: commandKeyHintOf(command, hooks.platform, hooks.wheelLabel)
            }))
        })
    )