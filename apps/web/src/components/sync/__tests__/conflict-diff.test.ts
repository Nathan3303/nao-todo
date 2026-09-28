// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import type {
    ConflictFieldDiff,
    ConflictListItem
} from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'
import {
    DIFF_SYMBOL,
    classifyFieldDiff,
    conflictTitleOf,
    formatFieldValue,
    groupConflictItems,
    isLongValue,
    isTechnicalField,
    visibleDiffs
} from '../conflict-diff'

/**
 * T332 —— 冲突 diff 展示层纯函数（可测部分）
 * 覆盖：① 分组（同对象多字段/多条 ⇒ 一组）② 技术字段默认隐藏/可展开判定 ③ 三态分类（增/删/改）
 * ④ 标题优雅降级（无标题 ⇒ ID/kind/兜底，**不得空白/undefined**）。
 */

const item = (over: Partial<ConflictListItem> = {}): ConflictListItem => ({
    id: 'tasks:t1:2026-09-24T00:00:00.000Z',
    kind: 'stale',
    table: 'tasks',
    entityId: 't1',
    loser: { name: '本地标题' },
    at: '2026-09-24T00:00:00.000Z',
    ...over
})

const diff = (over: Partial<ConflictFieldDiff> = {}): ConflictFieldDiff => ({
    field: 'name',
    loser: '旧',
    current: '新',
    ...over
})

describe('T332 conflict-diff 纯函数', () => {
    describe('三态分类（增/删/改）', () => {
        it('仅当前有值 ⇒ added；仅我的有值 ⇒ removed；两侧都有但不同 ⇒ changed', () => {
            expect(classifyFieldDiff(diff({ loser: null, current: '新' }))).toBe('added')
            expect(classifyFieldDiff(diff({ loser: '旧', current: null }))).toBe('removed')
            expect(classifyFieldDiff(diff({ loser: undefined, current: '新' }))).toBe('added')
            expect(classifyFieldDiff(diff({ loser: '旧', current: undefined }))).toBe('removed')
            expect(classifyFieldDiff(diff({ loser: '旧', current: '新' }))).toBe('changed')
        })

        it('三态符号齐备且互异（与颜色双承载）', () => {
            expect(DIFF_SYMBOL.added).toBeTruthy()
            expect(DIFF_SYMBOL.removed).toBeTruthy()
            expect(DIFF_SYMBOL.changed).toBeTruthy()
            expect(new Set(Object.values(DIFF_SYMBOL)).size).toBe(3)
        })
    })

    describe('技术字段判定（默认隐藏 / 可展开）', () => {
        it('时间戳 / 版本令牌 / 主键 / 排序 ⇒ 技术字段', () => {
            for (const field of [
                'id',
                'createdAt',
                'updatedAt',
                'deletedAt',
                'syncedServerUpdatedAt',
                'revision',
                'sortId'
            ]) {
                expect(isTechnicalField(field), field).toBe(true)
            }
        })

        it('业务字段 ⇒ 非技术字段', () => {
            for (const field of ['name', 'description', 'state', 'priority', 'tags']) {
                expect(isTechnicalField(field), field).toBe(false)
            }
        })

        it('visibleDiffs：默认过滤技术字段；开关打开 ⇒ 全量且保持原顺序', () => {
            const diffs = [
                diff({ field: 'name', loser: '旧', current: '新' }),
                diff({ field: 'updatedAt', loser: 'A', current: 'B' }),
                diff({ field: 'revision', loser: 1, current: 2 })
            ]
            expect(visibleDiffs(diffs, false).map((d) => d.field)).toEqual(['name'])
            expect(visibleDiffs(diffs, true).map((d) => d.field)).toEqual([
                'name',
                'updatedAt',
                'revision'
            ])
        })
    })

    describe('按对象分组（同实体多字段/多条 ⇒ 一组）', () => {
        it('同 table:entityId 的多条 ⇒ 一组，组内保持顺序', () => {
            const groups = groupConflictItems([
                item({ id: 'a', at: '2026-09-24T00:00:00.000Z' }),
                item({ id: 'b', at: '2026-09-24T00:01:00.000Z' }),
                item({ id: 'c', table: 'projects', entityId: 'p1' })
            ])
            expect(groups).toHaveLength(2)
            expect(groups[0]!.key).toBe('tasks:t1')
            expect(groups[0]!.items.map((i) => i.id)).toEqual(['a', 'b'])
            expect(groups[1]!.key).toBe('projects:p1')
            expect(groups[1]!.items).toHaveLength(1)
        })

        it('空列表 ⇒ 空分组', () => {
            expect(groupConflictItems([])).toEqual([])
        })
    })

    describe('标题优雅降级（不得空白 / undefined）', () => {
        it('name 优先，其次 title', () => {
            expect(conflictTitleOf(item({ loser: { name: '名字' } }), '未知对象')).toBe('名字')
            expect(conflictTitleOf(item({ loser: { title: '标题' } }), '未知对象')).toBe('标题')
        })

        it('无 loser（快照缺失）⇒ 回退 entityId', () => {
            expect(conflictTitleOf(item({ loser: null, entityId: 't-9' }), '未知对象')).toBe('t-9')
        })

        it('entityId 空 ⇒ 回退 fallback（组件传本地化 kind / 未知对象）', () => {
            expect(conflictTitleOf(item({ loser: null, entityId: '' }), '版本不匹配')).toBe(
                '版本不匹配'
            )
            expect(conflictTitleOf(item({ loser: null, entityId: '' }), '未知对象')).toBe(
                '未知对象'
            )
        })

        it('全空 ⇒ 兜底文案；且永不空白/undefined', () => {
            const title = conflictTitleOf(
                item({
                    loser: null,
                    entityId: '',
                    kind: '' as unknown as ConflictListItem['kind']
                }),
                '未知对象'
            )
            expect(title).toBe('未知对象')
            expect(title).not.toBe('')
            expect(title).not.toBeUndefined()
        })

        it('name 为空白串 ⇒ 不采用，回退 entityId', () => {
            expect(
                conflictTitleOf(item({ loser: { name: '   ' }, entityId: 't-9' }), '未知对象')
            ).toBe('t-9')
        })
    })

    describe('值格式化 / 长值', () => {
        it('null/undefined ⇒ —；对象 ⇒ JSON；标量 ⇒ String', () => {
            expect(formatFieldValue(null)).toBe('—')
            expect(formatFieldValue(undefined)).toBe('—')
            expect(formatFieldValue({ a: 1 })).toBe('{"a":1}')
            expect(formatFieldValue([1, 2])).toBe('[1,2]')
            expect(formatFieldValue(25)).toBe('25')
            expect(formatFieldValue(false)).toBe('false')
        })

        it('isLongValue：严格超过阈值才为长值', () => {
            expect(isLongValue('a'.repeat(80), 80)).toBe(false)
            expect(isLongValue('a'.repeat(81), 80)).toBe(true)
        })
    })
})