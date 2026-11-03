// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import type { ConflictListItem } from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'
import {
    SHORT_ID_LENGTH,
    collectConflictTitles,
    conflictObjectTitle,
    recordTitleName,
    shortEntityId
} from '../conflict-title'

/**
 * DEF-134 红基线 —— 左栏标题必须能**指认对象**
 *
 * 走查原话③：「非任务类型的冲突会显示记录 id（比如评论），用户不知道是个什么东西冲突了」。
 * 根因：标题取**败方快照**（`loser.name` / `loser.title`）⇒ 评论 / 检查项快照无 `name` ⇒ 落到裸 `entityId`。
 * 契约（DESIGN §4.7「左栏」）：当前行可读名 ⇒「父任务名 · 摘要」⇒ 表名 + 短 ID（≤8）；
 * ⛔ **不得只显示裸记录 ID**（快照回退实现下本条必红）。
 */

const item = (over: Partial<ConflictListItem> = {}): ConflictListItem => ({
    id: 'tasks:t1:2026-11-03T00:00:00.000Z',
    kind: 'stale',
    table: 'tasks',
    entityId: 't1',
    loser: { name: '旧标题' },
    at: '2026-11-03T00:00:00.000Z',
    ...over
})

/** 表名 → 标签（测试里给确定性标签，避免依赖 i18n 文案） */
const tableLabel = (table: string): string =>
    ({ tasks: '任务', taskComments: '评论', taskCheckItems: '检查项', projects: '项目' })[table] ??
    table

describe('DEF-134 recordTitleName（当前行 ⇒ 可读名）', () => {
    it('评论取 content（折叠空白）；检查项 / 任务取 name', () => {
        expect(recordTitleName('taskComments', { content: '  这是\n评论  ' })).toBe('这是 评论')
        expect(recordTitleName('taskCheckItems', { name: '检查项 A' })).toBe('检查项 A')
        expect(recordTitleName('tasks', { name: '写周报' })).toBe('写周报')
        expect(recordTitleName('projects', { name: '工作' })).toBe('工作')
    })

    it('当前行缺失 / 空白 ⇒ null（由调用方降级，不臆造）', () => {
        expect(recordTitleName('taskComments', null)).toBeNull()
        expect(recordTitleName('taskComments', { content: '   ' })).toBeNull()
        expect(recordTitleName('tasks', {})).toBeNull()
    })
})

describe('DEF-134 conflictObjectTitle（左栏标题解析）', () => {
    it('评论 ⇒「父任务名 · 评论摘要」；检查项 ⇒「父任务名 · 检查项名」', () => {
        expect(
            conflictObjectTitle(
                { table: 'taskComments', entityId: 'c1' },
                { name: '晚点再说', parentTaskName: '写周报' },
                tableLabel
            )
        ).toBe('写周报 · 晚点再说')
        expect(
            conflictObjectTitle(
                { table: 'taskCheckItems', entityId: 'i1' },
                { name: '买牛奶', parentTaskName: '写周报' },
                tableLabel
            )
        ).toBe('写周报 · 买牛奶')
    })

    it('父任务名取不到 ⇒ 退为自身名（仍可读）', () => {
        expect(
            conflictObjectTitle(
                { table: 'taskComments', entityId: 'c1' },
                { name: '晚点再说', parentTaskName: null },
                tableLabel
            )
        ).toBe('晚点再说')
    })

    it('当前行也取不到 ⇒ 表名 + 短 ID（≤8），⛔ 不是裸记录 ID', () => {
        const entityId = '0f2b9c1d-7a55-4c0e-9f00-6f6f6f6f6f6f'
        const title = conflictObjectTitle(
            { table: 'taskComments', entityId },
            { name: null, parentTaskName: null },
            tableLabel
        )
        expect(title).toBe(`评论 · ${entityId.slice(0, SHORT_ID_LENGTH)}`)
        // 红基线关键断言：快照回退实现会返回整串 entityId ⇒ 必红
        expect(title).not.toBe(entityId)
        expect(title).not.toContain(entityId)
    })

    it('无标题来源（快照只存差异字段）也绝不落裸 ID —— 咬住「只显示记录 ID」的 bug', () => {
        const entityId = 'legacy-comment-id'
        const title = conflictObjectTitle(
            { table: 'taskComments', entityId },
            undefined,
            tableLabel
        )
        expect(title).toBe('评论 · legacy-c')
        expect(title).not.toBe(entityId)
    })

    it('entityId 为空 ⇒ 表名兜底（非空、无 undefined）', () => {
        const title = conflictObjectTitle({ table: 'tasks', entityId: '' }, undefined, tableLabel)
        expect(title).toBe('任务')
        expect(title).not.toContain('undefined')
        expect(title).not.toContain('null')
    })

    it('shortEntityId 取前 8 位', () => {
        expect(shortEntityId('abcdefghijk')).toBe('abcdefgh')
        expect(shortEntityId('')).toBe('')
    })
})

describe('DEF-134 collectConflictTitles（按对象去重 / 父任务只查一次）', () => {
    const records: Record<string, Record<string, unknown>> = {
        'taskComments:c1': { id: 'c1', taskId: 't1', content: '评论一' },
        'taskComments:c2': { id: 'c2', taskId: 't1', content: '评论二' },
        'taskCheckItems:i1': { id: 'i1', taskId: 't2', name: '检查项一' },
        'tasks:t1': { id: 't1', name: '写周报' },
        'tasks:t2': { id: 't2', name: '买菜' }
    }

    it('评论 / 检查项带父任务名；同对象多条只查一次当前行；同父任务只查一次', async () => {
        const getCurrent = vi.fn(async (table: string, entityId: string) => {
            return records[`${table}:${entityId}`] ?? null
        })
        const tiles = await collectConflictTitles(
            [
                item({ id: 'a', table: 'taskComments', entityId: 'c1' }),
                item({ id: 'b', table: 'taskComments', entityId: 'c1' }),
                item({ id: 'c', table: 'taskComments', entityId: 'c2' }),
                item({ id: 'd', table: 'taskCheckItems', entityId: 'i1' }),
                item({ id: 'e', table: 'tasks', entityId: 'missing' })
            ],
            { getCurrent }
        )

        expect(tiles['taskComments:c1']).toEqual({ name: '评论一', parentTaskName: '写周报' })
        expect(tiles['taskComments:c2']).toEqual({ name: '评论二', parentTaskName: '写周报' })
        expect(tiles['taskCheckItems:i1']).toEqual({ name: '检查项一', parentTaskName: '买菜' })
        expect(tiles['tasks:missing']).toEqual({ name: null, parentTaskName: null })

        const taskCalls = getCurrent.mock.calls
            .filter(([table]) => table === 'tasks')
            .map(([, id]) => id)
        // 父任务按 taskId 缓存 ⇒ t1 只查一次（两条评论共用），t2 一次
        expect(taskCalls.filter((id) => id === 't1')).toHaveLength(1)
        expect(taskCalls.filter((id) => id === 't2')).toHaveLength(1)
        // 同一对象（c1）两条 journal 记录 ⇒ 当前行只读一次
        expect(
            getCurrent.mock.calls.filter(([table, id]) => table === 'taskComments' && id === 'c1')
        ).toHaveLength(1)
    })

    it('读取异常 ⇒ 该对象降级（不抛错、不影响其它对象）', async () => {
        const getCurrent = vi.fn(async (table: string, entityId: string) => {
            if (entityId === 'boom') throw new Error('decrypt-failed')
            return records[`${table}:${entityId}`] ?? null
        })
        const titles = await collectConflictTitles(
            [
                item({ id: 'a', table: 'taskComments', entityId: 'boom' }),
                item({ id: 'b', table: 'tasks', entityId: 't1' })
            ],
            { getCurrent }
        )
        expect(titles['taskComments:boom']).toEqual({ name: null, parentTaskName: null })
        expect(titles['tasks:t1']).toEqual({ name: '写周报', parentTaskName: null })
        // 降级后仍能给出可读标题（表名 + 短 ID，不是裸 ID）
        expect(
            conflictObjectTitle(
                { table: 'taskComments', entityId: 'boom' },
                titles['taskComments:boom'],
                tableLabel
            )
        ).toBe('评论 · boom')
    })

    it('空列表 ⇒ 空映射', async () => {
        const getCurrent = vi.fn(async () => null)
        expect(await collectConflictTitles([], { getCurrent })).toEqual({})
        expect(getCurrent).not.toHaveBeenCalled()
    })
})