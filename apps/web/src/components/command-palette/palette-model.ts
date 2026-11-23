import type { Command, Platform } from '@nao-todo/shared/commands'
import {
    commandDescriptionOf,
    commandGroupOf,
    commandKeyHintOf,
    commandLabelOf
} from './command-display'

/**
 * 命令面板 / 快捷键帮助的纯模型（零 Vue、零注册表依赖）
 * @description 入参是「已经取到的命令快照」，出参是可直接渲染的分组结构 ⇒ 可脱离组件单测。
 */

/** 按 key 归组，组顺序 = 首次出现顺序（组内顺序 = 入参顺序） */
export const groupInOrder = <T>(
    items: readonly T[],
    keyOf: (item: T) => string
): { name: string; items: T[] }[] => {
    const groups = new Map<string, T[]>()
    for (const item of items) {
        const name = keyOf(item)
        const bucket = groups.get(name)
        if (bucket) bucket.push(item)
        else groups.set(name, [item])
    }
    return Array.from(groups, ([name, grouped]) => ({ name, items: grouped }))
}

/** 面板条目（已是展示态：文案与键位提示均解析完毕） */
export interface PaletteEntry {
    id: string
    label: string
    description: string
    group: string
    icon?: string
    /** 已格式化的键位提示（无绑定则为空串） */
    hint: string
}

/** 带全局序号的条目（`index` 供 ↑/↓ 选择与 `aria-activedescendant` 使用） */
export interface PaletteOption extends PaletteEntry {
    index: number
}

export interface PaletteGroup {
    name: string
    options: PaletteOption[]
}

export interface PaletteSourceHooks {
    platform: Platform
    wheelLabel: string
}

/**
 * 注册表快照 → 面板条目
 * @description 只过滤 `hidden`（如命令面板自身的开关命令）——「不列哪些命令」写在注册处
 *              （`Command.hidden`），面板侧不维护任何 id 名单。
 *              ⛔ 不在此处另立命令清单：条目**全部**来自 `registry.getAll()`。
 */
export const buildPaletteEntries = (
    commands: readonly Command[],
    hooks: PaletteSourceHooks
): PaletteEntry[] =>
    commands
        .filter((command) => command.hidden !== true)
        .map((command) => ({
            id: command.id,
            label: commandLabelOf(command),
            description: commandDescriptionOf(command),
            group: commandGroupOf(command),
            icon: command.icon,
            hint: commandKeyHintOf(command, hooks.platform, hooks.wheelLabel)
        }))

/**
 * 大小写不敏感的即时过滤（匹配 `label` 与 `description`）
 * @description 空查询返回全部；`trim` 后查询也不匹配 id（面板不展示内部 id）。
 */
export const filterPaletteEntries = (
    entries: readonly PaletteEntry[],
    query: string
): PaletteEntry[] => {
    const keyword = query.trim().toLowerCase()
    if (keyword === '') return [...entries]
    return entries.filter(
        (entry) =>
            entry.label.toLowerCase().includes(keyword) ||
            entry.description.toLowerCase().includes(keyword)
    )
}

/** 分组并写入全局序号（↑/↓ 在**拍平后**的条目上移动） */
export const groupPaletteEntries = (entries: readonly PaletteEntry[]): PaletteGroup[] => {
    let index = 0
    return groupInOrder(entries, (entry) => entry.group).map((group) => ({
        name: group.name,
        options: group.items.map((entry) => ({ ...entry, index: index++ }))
    }))
}

/** 拍平（选择态与执行都基于同一序列） */
export const flattenPaletteGroups = (groups: readonly PaletteGroup[]): PaletteOption[] =>
    groups.flatMap((group) => group.options)