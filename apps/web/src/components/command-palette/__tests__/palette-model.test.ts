// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import type { Command } from '@nao-todo/shared/commands'
import {
    buildPaletteEntries,
    filterPaletteEntries,
    flattenPaletteGroups,
    groupPaletteEntries
} from '../palette-model'

/**
 * T766 · 命令面板纯模型（Issue #371）
 *
 * @description 面板条目**只**来自注册表快照：`hidden` 不列、键位提示按平台格式化、
 *              过滤匹配 label + description（大小写不敏感）、分组顺序 = 首次出现顺序。
 *              这里不挂组件 ⇒ 面板若不接注册表，本文件不会红，故另有组件/派生用例守护。
 */

const command = (partial: Partial<Command> & { id: string }): Command => ({
    handler: () => {},
    ...partial
})

const HOOKS = { platform: 'win', wheelLabel: '滚轮' } as const

describe('T766 · buildPaletteEntries（注册表 → 条目）', () => {
    it('`hidden` 命令不列（命令面板自身）；其余照注册顺序输出', () => {
        const entries = buildPaletteEntries(
            [
                command({
                    id: 'app.command-palette.open',
                    label: '打开命令面板',
                    hidden: true,
                    keyboard: { keys: '$mod+k' }
                }),
                command({ id: 'app.shortcuts.show', label: '快捷键帮助' }),
                command({ id: 'app.settings.open', label: '打开设置' })
            ],
            HOOKS
        )
        expect(entries.map((entry) => entry.id)).toEqual([
            'app.shortcuts.show',
            'app.settings.open'
        ])
    })

    it('键位提示按平台格式化；无绑定 ⇒ 空串；手势也算键位', () => {
        const entries = buildPaletteEntries(
            [
                command({ id: 'a', label: 'A', keyboard: { keys: '$mod+k' } }),
                command({ id: 'b', label: 'B' }),
                command({ id: 'c', label: 'C', gesture: '$mod+wheel' })
            ],
            { platform: 'mac', wheelLabel: '滚轮' }
        )
        expect(entries.map((entry) => entry.hint)).toEqual(['⌘+K', '', '⌘+滚轮'])
    })

    it('文案走 i18n 键（语言默认 zh-CN）；无分组归「其他」', () => {
        const entries = buildPaletteEntries(
            [
                command({
                    id: 'x',
                    i18n: {
                        label: 'commands.command.openSettings',
                        description: 'commands.command.openSettings.description',
                        group: 'commands.group.system'
                    }
                })
            ],
            HOOKS
        )
        expect(entries[0]!.label).toBe('打开设置')
        expect(entries[0]!.description).toBe('打开设置对话框')
        expect(entries[0]!.group).toBe('系统')

        const ungrouped = buildPaletteEntries([command({ id: 'y', label: 'Y' })], HOOKS)
        expect(ungrouped[0]!.group).toBe('其他')
    })
})

describe('T766 · filterPaletteEntries（即时过滤）', () => {
    const entries = buildPaletteEntries(
        [
            command({ id: 'zzz-1', label: 'New Task', description: 'Open the task creator' }),
            command({ id: 'zzz-2', label: 'New List', description: 'Open the list creator' }),
            command({ id: 'zzz-3', label: 'Zoom in', description: 'Day view' })
        ],
        HOOKS
    )

    it('空查询 ⇒ 全部', () => {
        expect(filterPaletteEntries(entries, '')).toHaveLength(3)
        expect(filterPaletteEntries(entries, '   ')).toHaveLength(3)
    })

    it('大小写不敏感，命中 label', () => {
        expect(filterPaletteEntries(entries, 'new task').map((entry) => entry.id)).toEqual([
            'zzz-1'
        ])
        expect(filterPaletteEntries(entries, 'NEW').map((entry) => entry.id)).toEqual([
            'zzz-1',
            'zzz-2'
        ])
    })

    it('命中 description', () => {
        expect(filterPaletteEntries(entries, 'creator').map((entry) => entry.id)).toEqual([
            'zzz-1',
            'zzz-2'
        ])
    })

    it('不按内部 id 命中（面板不暴露命令 id）', () => {
        expect(filterPaletteEntries(entries, 'day view')).toHaveLength(1)
        expect(filterPaletteEntries(entries, 'zzz')).toHaveLength(0)
    })
})

describe('T766 · groupPaletteEntries（分组 + 全局序号）', () => {
    it('组顺序 = 首次出现顺序；序号跨组连续（↑/↓ 用同一序列）', () => {
        const groups = groupPaletteEntries(
            buildPaletteEntries(
                [
                    command({ id: 'a', label: 'A', group: '系统' }),
                    command({ id: 'b', label: 'B', group: '导航' }),
                    command({ id: 'c', label: 'C', group: '系统' })
                ],
                HOOKS
            )
        )
        expect(groups.map((group) => group.name)).toEqual(['系统', '导航'])
        expect(groups[0]!.options.map((option) => option.id)).toEqual(['a', 'c'])
        expect(groups[1]!.options.map((option) => option.id)).toEqual(['b'])
        expect(flattenPaletteGroups(groups).map((option) => option.index)).toEqual([0, 1, 2])
    })
})