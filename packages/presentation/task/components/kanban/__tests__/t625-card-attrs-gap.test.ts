// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { TaskTagViewObject, TaskViewObject } from '@nao-todo/domain-task'
import { defaultColumns, type TaskColumnOptions } from '@nao-todo/shared/constants'
import { t } from '@nao-todo/shared/locales'
import TaskKanbanColumnItem from '../kanban-column-item.vue'
import { TASK_KANBAN_CONTEXT_KEY } from '../use-kanban'
import type { TaskKanbanContext } from '../types'
import { makeTask, NUE_COMPONENTS } from './t608-kanban-harness'

/**
 * `T625` / `DEF-127` —— 看板卡片属性区**空盒子**吃父级 flex `gap`
 *
 * @description 根因：判定 `isAttrsNone` 遍历**全部** `TaskColumnOptions` 键（只跳 `description`）
 *              并额外挂 `!task.tags.length`，而 `.todo-card__attrs` 内实际只有 6 个子项
 *              （`createdAt` / `updatedAt` / `endAt` / `state` / `priority` / `project`）
 *              ⇒ 两处口径不一致时渲染出**空盒子**，父级 `gap: .5rem` 仍然生效，卡片底部多出空隙。
 *
 *              判据落在**用户可见的 DOM**：`.todo-card__attrs` 是否存在 + 子项文案与顺序；
 *              AC5 追加**源码级守卫**（jsdom 不解析 CSS ⇒ 空盒子兜底只能源码断言）。
 */

/** 建一张卡片（真实组件；只 `provide` 看板上下文里卡片自身用到的 5 个方法） */
const mountCard = (
    task: TaskViewObject,
    columns: TaskColumnOptions,
    tags: TaskTagViewObject[] = []
): VueWrapper =>
    mount(TaskKanbanColumnItem, {
        props: { task, columns, tags },
        global: {
            components: NUE_COMPONENTS,
            provide: {
                [TASK_KANBAN_CONTEXT_KEY]: {
                    showTaskDetails: () => {},
                    deleteOrRestore: () => {},
                    finishTask: () => {},
                    unfinishTask: () => {},
                    getProjectName: () => ''
                } as unknown as TaskKanbanContext
            }
        }
    })

/** 全 false 的列配置基线（逐项显式列出 ⇒ 新增列键时由 `vp check` 拦住） */
const ALL_OFF: TaskColumnOptions = {
    name: false,
    description: false,
    state: false,
    priority: false,
    startAt: false,
    endAt: false,
    project: false,
    tags: false,
    givenUpAt: false,
    starMarkAt: false,
    archivedAt: false,
    createdAt: false,
    updatedAt: false,
    deletedAt: false
}

const columnsOf = (...keys: Array<keyof TaskColumnOptions>): TaskColumnOptions => {
    const columns = { ...ALL_OFF }
    for (const key of keys) columns[key] = true
    return columns
}

/** 属性区容器（不存在 ⇒ `null`） */
const attrsNode = (wrapper: VueWrapper): Element | null =>
    wrapper.element.querySelector('.todo-card__attrs')

/** 属性区子项文案（按渲染顺序；`task-basic-info` 的 `.nue-div--basic-info` 即每个子项） */
const attrTexts = (wrapper: VueWrapper): string[] => {
    const node = attrsNode(wrapper)
    if (!node) return []
    return Array.from(node.querySelectorAll('.nue-div--basic-info')).map((el) =>
        (el.textContent ?? '').replace(/\s+/g, '')
    )
}

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const TAG: TaskTagViewObject = { id: 'tag-1', name: '标签一', color: '#0a7' }

describe('T625 · DEF-127 卡片属性区空盒子', () => {
    it('AC1 只勾 name + tags 且任务有标签 ⇒ 不存在 .todo-card__attrs（标签照常渲染）', () => {
        wrapper = mountCard(makeTask({ id: 'ac1', tags: [TAG.id] }), columnsOf('name', 'tags'), [
            TAG
        ])

        // 前提：标签确实渲染在 __info 里（旧判据正是因它而误判「有内容」）
        expect(wrapper.findAll('.tag-node').length).toBe(1)
        expect(attrsNode(wrapper)).toBeNull()
    })

    it('AC2 只勾 name、任务无标签 ⇒ 不存在 .todo-card__attrs', () => {
        wrapper = mountCard(makeTask({ id: 'ac2' }), columnsOf('name'))

        expect(attrsNode(wrapper)).toBeNull()
    })

    it('AC3 勾 state / priority / endAt / project 任一 ⇒ 存在且子项正确', () => {
        const cases: Array<{
            key: keyof TaskColumnOptions
            task?: Partial<TaskViewObject>
            text: string
        }> = [
            { key: 'state', text: t('task.state.todo') },
            { key: 'priority', text: t('task.priority.medium') },
            { key: 'endAt', task: { endAt: '2026-11-20 10:00:00' }, text: '截止于' },
            { key: 'project', text: '收集箱' }
        ]

        for (const { key, task, text } of cases) {
            const single = mountCard(makeTask({ id: `ac3-${key}`, ...task }), columnsOf(key))
            expect(attrsNode(single), `columns.${key} 应渲染属性区`).not.toBeNull()
            const texts = attrTexts(single)
            expect(texts.length, `columns.${key} 应只有 1 个子项`).toBe(1)
            expect(texts[0]?.startsWith(text), `columns.${key} 文案实测「${texts[0]}」`).toBe(true)
            single.unmount()
        }
    })

    it('AC4 默认列配置 ⇒ 子项集合与顺序不变（updatedAt / endAt / state / priority / project）', () => {
        wrapper = mountCard(makeTask({ id: 'ac4', endAt: '2026-11-20 10:00:00' }), {
            ...defaultColumns
        } as TaskColumnOptions)

        const texts = attrTexts(wrapper)
        expect(texts.length).toBe(5)
        expect(texts[0]?.startsWith('修改于'), `实测「${texts[0]}」`).toBe(true)
        expect(texts[1]?.startsWith('截止于'), `实测「${texts[1]}」`).toBe(true)
        expect(texts[2]).toBe(t('task.state.todo'))
        expect(texts[3]).toBe(t('task.priority.medium'))
        expect(texts[4]).toBe('收集箱')
    })

    it('AC5 源码守卫：判定与 6 个子项同源，且不再遍历全部列选项', () => {
        const sources = Object.values(
            import.meta.glob(
                '/packages/presentation/task/components/kanban/kanban-column-item.vue',
                {
                    query: '?raw',
                    import: 'default',
                    eager: true
                }
            ) as Record<string, string>
        ) as string[]
        const source = sources[0] ?? ''
        expect(source.length).toBeGreaterThan(0)

        // ① 不再有「遍历全部列选项」的判据（旧实现的循环）
        expect(source).not.toMatch(/for\s*\(\s*const\s+\w+\s+in\s+props\.columns\s*\)/)
        expect(source).not.toContain('isAttrsNone')

        // ② 同源判定：`hasCardAttrs` 只由属性区内的 6 个键决定
        const computedBlock =
            source.match(/const hasCardAttrs = computed\(([\s\S]*?)\n\)/)?.[1] ?? ''
        expect(computedBlock.length).toBeGreaterThan(0)
        for (const key of ['createdAt', 'updatedAt', 'endAt', 'state', 'priority', 'project']) {
            expect(computedBlock, `hasCardAttrs 缺 ${key}`).toContain(`columns?.${key}`)
        }
        // 非属性区维度（渲染在别处或根本不渲染）不得参与判定
        for (const key of ['tags', 'name', 'description', 'startAt', 'givenUpAt', 'starMarkAt']) {
            expect(computedBlock, `hasCardAttrs 不应包含 ${key}`).not.toContain(key)
        }

        // ③ 模板用新判定（旧缺陷路径 `v-if="!isAttrsNone"` 已移除）
        expect(source).toContain('v-if="hasCardAttrs"')

        // ④ 兜底：`.todo-card__attrs:empty { display: none; }`
        const cssSources = Object.values(
            import.meta.glob('/packages/presentation/task/components/kanban/kanban.css', {
                query: '?raw',
                import: 'default',
                eager: true
            }) as Record<string, string>
        ) as string[]
        const css = cssSources[0] ?? ''
        expect(css.length).toBeGreaterThan(0)
        const attrsBlock = css.slice(
            css.indexOf('.todo-card__attrs'),
            css.indexOf('.todo-card__attrs') + 400
        )
        expect(attrsBlock.startsWith('.todo-card__attrs')).toBe(true)
        expect(attrsBlock).toMatch(/:empty\s*\{[^}]*display:\s*none/)
    })
})