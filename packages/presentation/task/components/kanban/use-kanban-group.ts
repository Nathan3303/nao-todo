import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'
import { KANBAN_DEFAULT_GROUP_BY } from './constants'

/**
 * 看板分组状态（`T613` 状态上提）
 * @description 分组状态从 `use-kanban.ts` 内部搬到页面 Provider —— 菜单（页面 header）与看板
 *              （页面 main）跨层共用同一份 ref（ADR
 *              `docs/adr/2026-11-01-kanban-group-state-hoisting.md` · PRD R-D 单一来源）。
 */
export type KanbanGroupBy = 'state' | 'priority'

// @constant 分组状态注入键（唯一创建点 = `provideKanbanGroup`）
export const KANBAN_GROUP_BY_KEY: InjectionKey<Ref<KanbanGroupBy>> = Symbol('KANBAN_GROUP_BY_KEY')

const createKanbanGroup = (): Ref<KanbanGroupBy> => ref<KanbanGroupBy>(KANBAN_DEFAULT_GROUP_BY)

/**
 * 提供分组状态（每页视图组合式各 1 次；Provider = 两个 `router-view` 的父级）
 * @returns 本页唯一的分组状态（菜单与本页看板读同一份）
 */
export const provideKanbanGroup = (): Ref<KanbanGroupBy> => {
    const groupBy = createKanbanGroup()
    provide(KANBAN_GROUP_BY_KEY, groupBy)
    return groupBy
}

/**
 * 读取本页分组状态
 * @description 缺 Provider 时**开发态报错 + 本地回退**（ADR 风险①：菜单与看板各持一份 ref
 *              会静默分歧 ⇒ 宁可显式告警，也不静默错位）。
 */
export const useKanbanGroup = (): Ref<KanbanGroupBy> => {
    const groupBy = inject(KANBAN_GROUP_BY_KEY, null)
    if (groupBy) return groupBy
    if (import.meta.env.DEV) {
        console.error(
            '[useKanbanGroup] 缺少 Provider：请确认页面视图组合式调用了 provideKanbanGroup()'
        )
    }
    return createKanbanGroup()
}