// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vite-plus/test'
import {
    FIELD_GROUPS,
    SERVER_OWNED_FIELDS,
    mergeBusinessFields,
    type FieldMergeInput
} from '../field-merge'

/**
 * T677 / B 批 M2 —— **字段级三方合并内核**（`field-merge.ts` 纯函数单测）
 *
 * 口径（PRD `R-1`/`R-2`/`R-4` · ADR D4/D5/D7）：
 * - 判定四律：`R==B ⇒ L` · `L==B ⇒ R` · `R==L ⇒ 取其一` · 三者两两不等 ⇒ 冲突；
 * - 比较一律 `valuesEqual`（空哨兵归一），基准缺失 ⇒ 保守冲突（不猜测合并）；
 * - 字段类型规则：`tags` 逐元素三方 + 并集不丢 · `archivedAt` 归档优先 · `deletedAt` 不进合并域 ·
 *   服务端 owned 恒取 `R` · 提醒四字段按组原子；
 * - `mode='lww'` = 同一函数的整行赢家退化（不读 base、无字段级信号）；
 * - 幂等：同一输入重复计算结果不变。
 *
 * ⚠️ 本文件只测**内核**。AC1/AC2/AC4/AC5/AC6 的端到端红例走 pull/push，M3/M4 才接入。
 */

const merge = (
    input: Pick<FieldMergeInput, 'remote' | 'local'> & Partial<FieldMergeInput>
): ReturnType<typeof mergeBusinessFields> => mergeBusinessFields(input)

describe('T677 / R-2 四律（标量 / 枚举 / 布尔 / 时间 / 引用）', () => {
    const fields = ['name', 'priority', 'state', 'startAt', 'parentTaskId']

    it('R==B ⇒ 取 L（我改的生效）', () => {
        const result = merge({
            base: { name: 'A', priority: 'medium', state: 'todo', startAt: null, parentTaskId: '' },
            remote: {
                name: 'A',
                priority: 'medium',
                state: 'todo',
                startAt: null,
                parentTaskId: ''
            },
            local: {
                name: 'B',
                priority: 'high',
                state: 'done',
                startAt: '2026-01-01',
                parentTaskId: 'p2'
            },
            fields
        })
        expect(result.merged).toEqual({
            name: 'B',
            priority: 'high',
            state: 'done',
            startAt: '2026-01-01',
            parentTaskId: 'p2'
        })
        expect(result.conflicts).toEqual([])
    })

    it('L==B ⇒ 取 R（对方改的生效）', () => {
        const result = merge({
            base: { name: 'A', priority: 'medium', state: 'todo', startAt: null, parentTaskId: '' },
            remote: {
                name: 'A2',
                priority: 'low',
                state: 'done',
                startAt: '2026-02-02',
                parentTaskId: 'p9'
            },
            local: {
                name: 'A',
                priority: 'medium',
                state: 'todo',
                startAt: null,
                parentTaskId: ''
            },
            fields
        })
        expect(result.merged).toEqual({
            name: 'A2',
            priority: 'low',
            state: 'done',
            startAt: '2026-02-02',
            parentTaskId: 'p9'
        })
        expect(result.conflicts).toEqual([])
    })

    it('R==L ⇒ 取其一、不冲突（即使与 B 不同）', () => {
        const result = merge({
            base: { name: 'A' },
            remote: { name: 'same' },
            local: { name: 'same' },
            fields: ['name']
        })
        expect(result.merged).toEqual({ name: 'same' })
        expect(result.conflicts).toEqual([])
    })

    it('三者两两不等 ⇒ 冲突，merged 取 winner（默认 local）', () => {
        const result = merge({
            base: { name: 'A' },
            remote: { name: 'R' },
            local: { name: 'L' },
            fields: ['name']
        })
        expect(result.merged).toEqual({ name: 'L' })
        expect(result.conflicts).toEqual(['name'])
    })

    it('三者两两不等 + lwwWinner=remote ⇒ merged 取 R（边界覆盖用）', () => {
        const result = merge({
            base: { name: 'A' },
            remote: { name: 'R' },
            local: { name: 'L' },
            fields: ['name'],
            lwwWinner: 'remote'
        })
        expect(result.merged).toEqual({ name: 'R' })
        expect(result.conflicts).toEqual(['name'])
    })

    it('无基准（base 缺该字段）且 R≠L ⇒ 保守冲突', () => {
        const result = merge({
            base: {},
            remote: { name: 'R' },
            local: { name: 'L' },
            fields: ['name']
        })
        expect(result.merged).toEqual({ name: 'L' })
        expect(result.conflicts).toEqual(['name'])
    })

    it('无基准且 R==L ⇒ 不冲突', () => {
        const result = merge({
            remote: { name: 'same' },
            local: { name: 'same' },
            fields: ['name']
        })
        expect(result.merged).toEqual({ name: 'same' })
        expect(result.conflicts).toEqual([])
    })

    it('空哨兵：R=null × L="" ⇒ valuesEqual 归空、不冲突', () => {
        const result = merge({
            base: { startAt: null },
            remote: { startAt: null },
            local: { startAt: '' },
            fields: ['startAt']
        })
        expect(result.conflicts).toEqual([])
        expect(result.merged).toEqual({ startAt: '' })
    })

    it('conflicts 按 fields 顺序输出（确定性）', () => {
        const result = merge({
            base: { name: 'A', priority: 'medium', description: 'd' },
            remote: { name: 'R1', priority: 'low', description: 'r' },
            local: { name: 'L1', priority: 'high', description: 'l' },
            fields: ['description', 'priority', 'name']
        })
        expect(result.conflicts).toEqual(['description', 'priority', 'name'])
    })
})

describe('T677 / tags：逐元素存在性三方 + 并集不丢（AC2）', () => {
    it('双方各加一个 ⇒ 并集；顺序 = 我的在前、对方新增追加', () => {
        const result = merge({
            base: { tags: [] },
            remote: { tags: ['#紧急'] },
            local: { tags: ['#工作'] },
            fields: ['tags']
        })
        expect(result.merged).toEqual({ tags: ['#工作', '#紧急'] })
        expect(result.conflicts).toEqual([])
    })

    it('同一标签双方都加 ⇒ 去重（不重复、不冲突）', () => {
        const result = merge({
            base: { tags: [] },
            remote: { tags: ['#a'] },
            local: { tags: ['#a'] },
            fields: ['tags']
        })
        expect(result.merged).toEqual({ tags: ['#a'] })
        expect(result.conflicts).toEqual([])
    })

    it('我删的标签不复活（即使对方仍保留）', () => {
        const result = merge({
            base: { tags: ['a', 'b'] },
            remote: { tags: ['a', 'b'] },
            local: { tags: ['b'] },
            fields: ['tags']
        })
        expect(result.merged).toEqual({ tags: ['b'] })
        expect(result.conflicts).toEqual([])
    })

    it('对方删的标签不复活（即使我仍保留）', () => {
        const result = merge({
            base: { tags: ['a', 'b'] },
            remote: { tags: ['b'] },
            local: { tags: ['a', 'b'] },
            fields: ['tags']
        })
        expect(result.merged).toEqual({ tags: ['b'] })
        expect(result.conflicts).toEqual([])
    })

    it('顺序差异（集合相同）⇒ 取我的顺序、不冲突、幂等', () => {
        const input = {
            base: { tags: ['a', 'b'] },
            remote: { tags: ['b', 'a'] },
            local: { tags: ['a', 'b'] },
            fields: ['tags'] as const
        }
        const first = merge(input)
        const second = merge(input)
        expect(first).toEqual({ merged: { tags: ['a', 'b'] }, conflicts: [] })
        expect(second).toEqual(first)
    })

    it('无基准且 R≠L ⇒ 保守冲突（并集不适用）', () => {
        const result = merge({
            remote: { tags: ['r'] },
            local: { tags: ['l'] },
            fields: ['tags']
        })
        expect(result.merged).toEqual({ tags: ['l'] })
        expect(result.conflicts).toEqual(['tags'])
    })

    it('R==L（含空数组）⇒ 不冲突', () => {
        const result = merge({
            base: { tags: ['a'] },
            remote: { tags: [] },
            local: { tags: [] },
            fields: ['tags']
        })
        expect(result).toEqual({ merged: { tags: [] }, conflicts: [] })
    })
})

describe('T677 / archivedAt：归档优先但其它字段继续合并（AC6）', () => {
    const fields = ['archivedAt', 'name', 'description']

    it('远端归档 × 本地未归档 ⇒ 取 R，其它字段照常合并、0 冲突', () => {
        const result = merge({
            base: { archivedAt: null, name: 'A', description: 'A-desc' },
            remote: { archivedAt: '2026-02-03T00:00:00.000Z', name: 'A', description: 'R-desc' },
            local: { archivedAt: null, name: 'L-name', description: 'A-desc' },
            fields
        })
        expect(result.merged).toEqual({
            archivedAt: '2026-02-03T00:00:00.000Z',
            name: 'L-name',
            description: 'R-desc'
        })
        expect(result.conflicts).toEqual([])
    })

    it('本地归档 × 远端未归档 ⇒ 取 L', () => {
        const result = merge({
            base: { archivedAt: null },
            remote: { archivedAt: null },
            local: { archivedAt: '2026-03-03T00:00:00.000Z' },
            fields: ['archivedAt']
        })
        expect(result.merged).toEqual({ archivedAt: '2026-03-03T00:00:00.000Z' })
        expect(result.conflicts).toEqual([])
    })

    it('两侧同为空 ⇒ 按三方（R==L 取其一）', () => {
        const result = merge({
            base: { archivedAt: null },
            remote: { archivedAt: '' },
            local: { archivedAt: null },
            fields: ['archivedAt']
        })
        expect(result.conflicts).toEqual([])
    })

    it('两侧都非空且不同 + 基准已知 ⇒ 按三方冲突（归档语义不吞掉同字段冲突）', () => {
        const result = merge({
            base: { archivedAt: null },
            remote: { archivedAt: '2026-01-01T00:00:00.000Z' },
            local: { archivedAt: '2026-02-02T00:00:00.000Z' },
            fields: ['archivedAt']
        })
        expect(result.conflicts).toEqual(['archivedAt'])
        expect(result.merged).toEqual({ archivedAt: '2026-02-02T00:00:00.000Z' })
    })

    it('我取消归档 × 远端仍归档 ⇒ 归档优先取 R、不冲突（三方律会误取 L）', () => {
        const result = merge({
            base: { archivedAt: '2026-01-01T00:00:00.000Z' },
            remote: { archivedAt: '2026-01-01T00:00:00.000Z' },
            local: { archivedAt: null },
            fields: ['archivedAt']
        })
        expect(result.merged).toEqual({ archivedAt: '2026-01-01T00:00:00.000Z' })
        expect(result.conflicts).toEqual([])
    })

    it('我取消归档 × 远端改归档时间 ⇒ 归档优先取 R、不冲突（三方律会判冲突）', () => {
        const result = merge({
            base: { archivedAt: '2026-01-01T00:00:00.000Z' },
            remote: { archivedAt: '2026-02-02T00:00:00.000Z' },
            local: { archivedAt: null },
            fields: ['archivedAt']
        })
        expect(result.merged).toEqual({ archivedAt: '2026-02-02T00:00:00.000Z' })
        expect(result.conflicts).toEqual([])
    })

    it('我归档 × 远端取消归档 ⇒ 归档优先取 L（三方律会误取 R）', () => {
        const result = merge({
            base: { archivedAt: '2026-01-01T00:00:00.000Z' },
            remote: { archivedAt: null },
            local: { archivedAt: '2026-01-01T00:00:00.000Z' },
            fields: ['archivedAt']
        })
        expect(result.merged).toEqual({ archivedAt: '2026-01-01T00:00:00.000Z' })
        expect(result.conflicts).toEqual([])
    })
})

describe('T677 / deletedAt：不进合并域（R-4，整行裁决）', () => {
    it('即使被放进 fields 也跳过（merged 无该键、conflicts 无该字段）', () => {
        const result = merge({
            base: { deletedAt: null, name: 'A' },
            remote: { deletedAt: '2026-02-02T00:00:00.000Z', name: 'R' },
            local: { deletedAt: null, name: 'L' },
            fields: ['deletedAt', 'name']
        })
        expect(result.merged).not.toHaveProperty('deletedAt')
        expect(result.conflicts).not.toContain('deletedAt')
        expect(result.merged).toEqual({ name: 'L' })
    })
})

describe('T677 / 提醒四字段按组原子（ADR D4 / AC15）', () => {
    const group = FIELD_GROUPS[0]!

    it('组外改 + 组内仅对方改 ⇒ 整组取 R、0 冲突', () => {
        const result = merge({
            base: {
                name: 'A',
                remindAt: null,
                remindRepeat: 'none',
                remindTime: '09:00',
                remindWeekdays: []
            },
            remote: {
                name: 'A',
                remindAt: null,
                remindRepeat: 'weekly',
                remindTime: '09:00',
                remindWeekdays: [1, 3, 5]
            },
            local: {
                name: 'L-name',
                remindAt: null,
                remindRepeat: 'none',
                remindTime: '09:00',
                remindWeekdays: []
            },
            fields: ['name', ...group]
        })
        expect(result.merged).toEqual({
            name: 'L-name',
            remindAt: null,
            remindRepeat: 'weekly',
            remindTime: '09:00',
            remindWeekdays: [1, 3, 5]
        })
        expect(result.conflicts).toEqual([])
    })

    it('仅我改组 ⇒ 整组取 L', () => {
        const result = merge({
            base: {
                remindAt: null,
                remindRepeat: 'none',
                remindTime: '09:00',
                remindWeekdays: []
            },
            remote: {
                remindAt: null,
                remindRepeat: 'none',
                remindTime: '09:00',
                remindWeekdays: []
            },
            local: {
                remindAt: '2026-05-05T00:00:00.000Z',
                remindRepeat: 'daily',
                remindTime: '08:00',
                remindWeekdays: [1]
            },
            fields: [...group]
        })
        expect(result.merged).toEqual({
            remindAt: '2026-05-05T00:00:00.000Z',
            remindRepeat: 'daily',
            remindTime: '08:00',
            remindWeekdays: [1]
        })
        expect(result.conflicts).toEqual([])
    })

    it('组内双方都改（不同字段）⇒ 整组冲突 + 整组取 winner（不混搭）', () => {
        const result = merge({
            base: {
                remindAt: null,
                remindRepeat: 'none',
                remindTime: '09:00',
                remindWeekdays: []
            },
            remote: {
                remindAt: null,
                remindRepeat: 'weekly',
                remindTime: '09:00',
                remindWeekdays: [1, 3, 5]
            },
            local: {
                remindAt: null,
                remindRepeat: 'none',
                remindTime: '08:00',
                remindWeekdays: []
            },
            fields: [...group]
        })
        // 我改的是 remindTime、对方改的是 remindRepeat/Weekdays ⇒ 整组冲突
        expect(result.conflicts).toEqual([...group])
        // 整组取本地（winner 默认 local）—— 不得出现「我的 08:00 + 对方的 weekly」
        expect(result.merged).toEqual({
            remindAt: null,
            remindRepeat: 'none',
            remindTime: '08:00',
            remindWeekdays: []
        })
    })

    it('组内双方改同一字段为同值 ⇒ 不冲突、整组取 R', () => {
        const result = merge({
            base: {
                remindAt: null,
                remindRepeat: 'none',
                remindTime: '09:00',
                remindWeekdays: []
            },
            remote: {
                remindAt: null,
                remindRepeat: 'daily',
                remindTime: '08:00',
                remindWeekdays: [2]
            },
            local: {
                remindAt: null,
                remindRepeat: 'daily',
                remindTime: '08:00',
                remindWeekdays: [2]
            },
            fields: [...group]
        })
        expect(result.conflicts).toEqual([])
        expect(result.merged).toEqual({
            remindAt: null,
            remindRepeat: 'daily',
            remindTime: '08:00',
            remindWeekdays: [2]
        })
    })

    it('组内字段部分在合并域内 ⇒ 只输出/判定域内字段', () => {
        const result = merge({
            base: { remindRepeat: 'none', remindTime: '09:00' },
            remote: { remindRepeat: 'weekly', remindTime: '09:00' },
            local: { remindRepeat: 'none', remindTime: '09:00' },
            fields: ['remindRepeat', 'remindTime']
        })
        expect(result.merged).toEqual({ remindRepeat: 'weekly', remindTime: '09:00' })
        expect(result.conflicts).toEqual([])
    })
})

describe('T677 / 服务端 owned 与排序值', () => {
    it('派生计数恒取 R（即使 R≠L）', () => {
        const result = merge({
            base: { checkItemCount: 1 },
            remote: { checkItemCount: 5, commentCount: 2, subtaskCount: 3 },
            local: { checkItemCount: 9, commentCount: 0, subtaskCount: 0 },
            fields: [...SERVER_OWNED_FIELDS]
        })
        expect(result.merged).toEqual({ checkItemCount: 5, commentCount: 2, subtaskCount: 3 })
        expect(result.conflicts).toEqual([])
    })

    it('sortId：本地 0（未设置）⇒ 取 R', () => {
        const result = merge({
            base: { sortId: 0 },
            remote: { sortId: 42 },
            local: { sortId: 0 },
            fields: ['sortId']
        })
        expect(result.merged).toEqual({ sortId: 42 })
        expect(result.conflicts).toEqual([])
    })

    it('sortId：本地非 0 ⇒ 按三方（R==B 取 L）', () => {
        const result = merge({
            base: { sortId: 10 },
            remote: { sortId: 10 },
            local: { sortId: 20 },
            fields: ['sortId']
        })
        expect(result.merged).toEqual({ sortId: 20 })
        expect(result.conflicts).toEqual([])
    })
})

describe("T677 / mode='lww'（同一函数退化，AC14 的核内部分）", () => {
    const fields = ['name', 'description', 'priority']
    const base = { name: 'A', description: 'A-desc', priority: 'medium' }
    const remote = { name: 'R-name', description: 'R-desc', priority: 'low' }
    const local = { name: 'L-name', description: 'L-desc', priority: 'high' }

    it('lww + winner=local ⇒ 整行取 L、无字段级信号（不读 base）', () => {
        const result = merge({ base, remote, local, fields, mode: 'lww' })
        expect(result).toEqual({
            merged: { name: 'L-name', description: 'L-desc', priority: 'high' },
            conflicts: []
        })
    })

    it('lww + winner=remote ⇒ 整行取 R、无字段级信号', () => {
        const result = merge({ base, remote, local, fields, mode: 'lww', lwwWinner: 'remote' })
        expect(result).toEqual({
            merged: { name: 'R-name', description: 'R-desc', priority: 'low' },
            conflicts: []
        })
    })

    it('lww 不产出 conflicts（即使 merge 模式会冲突）', () => {
        const mergeResult = merge({ base, remote, local, fields })
        const lwwResult = merge({ base, remote, local, fields, mode: 'lww' })
        expect(mergeResult.conflicts).toEqual(['name', 'description', 'priority'])
        expect(lwwResult.conflicts).toEqual([])
    })
})

describe('T677 / 幂等、合并域与元数据隔离', () => {
    it('同一输入重复计算 ⇒ 结果逐字相同（含 tags / 冲突）', () => {
        const input = {
            base: { name: 'A', tags: ['a'], priority: 'medium' },
            remote: { name: 'R', tags: ['a', 'r'], priority: 'low' },
            local: { name: 'L', tags: ['a', 'l'], priority: 'high' },
            fields: ['name', 'tags', 'priority'] as const
        }
        const first = merge(input)
        const second = merge(input)
        expect(second).toEqual(first)
        expect(first.conflicts).toEqual(['name', 'priority'])
        expect(first.merged).toEqual({ name: 'L', tags: ['a', 'l', 'r'], priority: 'high' })
    })

    it('fields 缺省 ⇒ 取 local ∪ remote ∪ base，并剔除忽略集与墓碑', () => {
        const result = merge({
            base: { name: 'A', updatedAt: 't1', syncedServerUpdatedAt: 'b1' },
            remote: { name: 'R', id: 'x', userId: 'u', revision: 2, deletedAt: null },
            local: { name: 'L', updatedAt: 't2', baseUpdatedAt: 'b2' }
        })
        expect(result.merged).toEqual({ name: 'L' })
        expect(result.conflicts).toEqual(['name'])
        for (const metadata of [
            'id',
            'userId',
            'updatedAt',
            'syncedServerUpdatedAt',
            'revision',
            'baseUpdatedAt',
            'deletedAt'
        ]) {
            expect(result.merged).not.toHaveProperty(metadata)
        }
    })

    it('merged 不含 fieldBase / 同步元数据（防御：即使 fields 里塞了）', () => {
        const result = merge({
            base: { name: 'A' },
            remote: { name: 'R' },
            local: { name: 'L' },
            fields: ['name', 'fieldBase', 'syncedServerUpdatedAt', 'revision']
        })
        expect(Object.keys(result.merged)).toEqual(['name'])
    })

    it('域内字段两侧都不存在 ⇒ 按空哨兵等价、不冲突', () => {
        const result = merge({ base: {}, remote: {}, local: {}, fields: ['description'] })
        expect(result).toEqual({ merged: { description: undefined }, conflicts: [] })
    })
})