// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia } from 'pinia'
import { NueSwitch } from 'nue-ui'
import { messages } from '@nao-todo/shared/locales/messages'
import { QueryOptionsValueObject } from '@nao-todo/shared/valueobjects/query-options'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { nueUI } from '@/nue-ui-register'
import { buildChildQuery, buildRootQuery } from '../use-search'
import { searchTasks } from '../search-tasks'
import {
    EMPTY_SEARCH_QUERY,
    parseSearchQuery,
    searchQueryEquals,
    serializeSearchQuery
} from '../search-query'
import SearchFilterBar from '../search-filter-bar.vue'

/**
 * T181 · P2 搜索「包含已归档」开关 —— **自带接线级单测**
 * 真源：`docs/adr/2026-09-24-project-archive.md` §15.2（冻结命名）。
 * 覆盖三段接线：
 *   ① 查询构造（`buildRootQuery` / `buildChildQuery`）：开 ⇒ `includeArchived: true`；关 ⇒ `isArchived: false`；
 *   ② 搜索纯函数（`searchTasks`）：开 ⇒ 归档任务参与关键词命中；关 ⇒ 默认排除；
 *   ③ UI 接线（prop / `toggleArchived` 事件）+ URL 往返 + i18n（中英非空）。
 * ⚠️ 仓储侧「`includeArchived=true` ⇒ 命中归档任务」由 qa 红基线
 *    `packages/infrastructure/.../local-task-archive-search.baseline.test.ts` 钉死，此处不重复。
 */

const VARIANT = { isDeleted: false, isGivenUp: false }

/** 构造最小任务 VO（默认顶层/未删除/未归档/未放弃） */
const makeTask = (
    overrides: Partial<TaskViewObject> & Pick<TaskViewObject, 'id' | 'name'>
): TaskViewObject => {
    const defaults = {
        parentTaskId: '',
        userId: 'u1',
        description: '',
        state: 'todo',
        priority: 'low',
        startAt: '',
        endAt: '',
        projectId: '',
        tags: [],
        archivedAt: null,
        starMarkAt: null,
        givenUpAt: null,
        remindAt: null,
        remindRepeat: 'none',
        remindTime: null,
        remindWeekdays: [],
        isDeleted: false,
        isArchived: false,
        isStarMarked: false,
        isGivenUp: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    } as unknown as Omit<TaskViewObject, 'name'>
    return { ...defaults, ...overrides } as TaskViewObject
}

describe('T181 · 查询构造：开 ⇒ includeArchived 正向信号；关 ⇒ 显式 isArchived=false', () => {
    it('顶层：开 ⇒ includeArchived=true（不再传 isArchived）', () => {
        const query = buildRootQuery(1, VARIANT, true)
        expect(query.includeArchived).toBe(true)
        expect(query.isArchived).toBeUndefined()
    })

    it('顶层：关 ⇒ isArchived=false（不传 includeArchived）', () => {
        const query = buildRootQuery(1, VARIANT, false)
        expect(query.isArchived).toBe(false)
        expect(query.includeArchived).toBeUndefined()
    })

    it('子任务：与顶层同口径', () => {
        const on = buildChildQuery('p1', 1, true)
        expect(on.includeArchived).toBe(true)
        expect(on.isArchived).toBeUndefined()
        const off = buildChildQuery('p1', 1, false)
        expect(off.isArchived).toBe(false)
        expect(off.includeArchived).toBeUndefined()
    })

    it('端到端（构造 → 查询串 → 搜索）：开 ⇒ 归档任务命中；关 ⇒ 不命中', () => {
        const archived = makeTask({ id: 'a1', name: '买菜', isArchived: true })

        const on = buildRootQuery(1, VARIANT, true)
        expect(new QueryOptionsValueObject(on).toString()).toContain('includeArchived=true')
        expect(
            searchTasks([archived], '买菜', { includeArchived: on.includeArchived === true }).map(
                (row) => row.task.id
            )
        ).toEqual(['a1'])

        const off = buildRootQuery(1, VARIANT, false)
        expect(new QueryOptionsValueObject(off).toString()).toContain('isArchived=false')
        expect(searchTasks([archived], '买菜', { includeArchived: false })).toEqual([])
    })
})

describe('T181 · URL 往返 archived=1（自带）', () => {
    it("parse({ archived: '1' }) ⇒ includeArchived=true；缺省/非法 ⇒ false", () => {
        expect(parseSearchQuery({ archived: '1' }).includeArchived).toBe(true)
        expect(parseSearchQuery({}).includeArchived).toBe(false)
        expect(parseSearchQuery({ archived: 'bogus' }).includeArchived).toBe(false)
    })

    it("serialize：true ⇒ archived='1'；false ⇒ 省略", () => {
        expect(
            serializeSearchQuery({ ...EMPTY_SEARCH_QUERY, includeArchived: true }).archived
        ).toBe('1')
        expect(
            serializeSearchQuery({ ...EMPTY_SEARCH_QUERY, includeArchived: false }).archived
        ).toBeUndefined()
    })

    it('equals 区分 includeArchived', () => {
        expect(
            searchQueryEquals(
                { ...EMPTY_SEARCH_QUERY, includeArchived: true },
                { ...EMPTY_SEARCH_QUERY, includeArchived: false }
            )
        ).toBe(false)
    })
})

describe('T181 · UI 接线（search-filter-bar prop / toggleArchived 事件）', () => {
    const mountBar = (includeArchived: boolean) =>
        mount(SearchFilterBar, {
            global: { plugins: [nueUI, createPinia()] },
            props: {
                selectedProjectIds: [],
                selectedTagIds: [],
                selectedPriorities: [],
                selectedStates: [],
                active: false,
                includeExcluded: false,
                includeArchived,
                canSave: false
            }
        })

    it('渲染「包含已归档」开关并上抛 toggleArchived(true)', async () => {
        const wrapper = mountBar(false)
        const switches = wrapper.findAllComponents(NueSwitch)
        // 归档开关与「包含已删除/已放弃」同族同位置（紧邻其后）
        expect(switches).toHaveLength(2)
        const archivedSwitch = switches[1]!
        archivedSwitch.vm.$emit('update:model-value', true)
        await nextTick()
        expect(wrapper.emitted('toggleArchived')?.[0]).toEqual([true])
        wrapper.unmount()
    })

    it('关闭态切换上抛 toggleArchived(false)', async () => {
        const wrapper = mountBar(true)
        const archivedSwitch = wrapper.findAllComponents(NueSwitch)[1]!
        archivedSwitch.vm.$emit('update:model-value', false)
        await nextTick()
        expect(wrapper.emitted('toggleArchived')?.[0]).toEqual([false])
        wrapper.unmount()
    })
})

describe('T181 · i18n 文案键（中/英非空）', () => {
    const dict = (locale: 'zh-CN' | 'en-US') =>
        messages[locale] as unknown as Record<string, string>

    it.each(['search.includeArchived', 'search.state.archived'])(
        '中/英均存在非空文案：%s',
        (key) => {
            expect(dict('zh-CN')[key] ?? '').not.toBe('')
            expect(dict('en-US')[key] ?? '').not.toBe('')
        }
    )
})