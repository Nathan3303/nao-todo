import type { GetTasksOptions } from '@nao-todo/shared/constants'
import { computed, reactive, type ComputedRef, type InjectionKey, type Ref } from 'vue'

/**
 * 看板列内分页 —— 列注册表（ADR `docs/adr/2026-11-01-kanban-column-paging.md` 决策 1）
 *
 * @description 每列**自持** `useTasksLoader`（`use-kanban-column.ts`），父级只持有**句柄集合**，
 *              作为唯一编排入口：重置（刷新 / 筛选 / 排序）、拖拽增量、新增任务置顶。
 *              列内状态（page / loaded / isDone）不外泄；父级只需要**聚合摘要**
 *              （`settled` / `total` / `firstError`）来渲染外层 `loading-error`（R-N）。
 */

/** 列内分页摘要（外层空态 / 错误态判据，R-N） */
export type KanbanColumnSummary = {
    /** 所有列的首屏加载都已收敛（含「求交为空 ⇒ 不查询」的列） */
    settled: boolean
    /** 各列 `pagination.total` 之和 */
    total: number
    /** 首个列级错误（无错误 ⇒ 空串） */
    firstError: string
}

/** 单列摘要（列内上报，父级只读） */
export type KanbanColumnState = Omit<KanbanColumnSummary, 'settled'> & { settled: boolean }

/** 列句柄（父级可发起的编排动作；不含任何分页游标读写） */
export type KanbanColumnHandle = {
    category: string
    /** 回到第 1 页（RefreshData / 筛选 / 排序，R-C） */
    reset: () => Promise<void>
}

export type KanbanColumnPaging = {
    register: (handle: KanbanColumnHandle) => void
    unregister: (handle: KanbanColumnHandle) => void
    /** 各列回到第 1 页 */
    resetAll: () => Promise<void>
    /** 列内上报摘要 */
    report: (category: string, state: KanbanColumnState) => void
    summary: ComputedRef<KanbanColumnSummary>
}

/**
 * 列查询条件 = **用户基础筛选 ∩ 列条件**（R-I / ADR 硬约束 1）
 *
 * @description ⛔ 不得「覆盖」用户筛选：基础筛选里**已含**该维度且不含本列值 ⇒ 求交为空
 *              ⇒ 返回 `null`（该列 0 条且**不发请求**，不是发出去再在客户端过滤）。
 * @param base 用户基础筛选（页面下发，可能含 `state` / `priority`）
 * @param groupBy 当前分组维度
 * @param category 列名（= 该维度的取值）
 * @returns 求交后的查询条件；`null` = 求交为空
 */
export const kanbanColumnGetTasksOptions = (
    base: GetTasksOptions,
    groupBy: 'state' | 'priority',
    category: string
): GetTasksOptions | null => {
    const values = String(base[groupBy] ?? '')
        .split(',')
        .filter(Boolean)
    if (values.length > 0 && !values.includes(category)) return null
    return { ...base, [groupBy]: category }
}

/** 创建看板列注册表（`TaskKanban` 内唯一实例，经 `KANBAN_COLUMN_PAGING_KEY` 下发） */
export const useKanbanColumnPaging = (): KanbanColumnPaging => {
    /** 命令句柄（非响应式：只承载动作） */
    const handles = new Map<string, KanbanColumnHandle>()

    /** 列摘要（响应式：只承载聚合信息） */
    const columnStates = reactive<Record<string, KanbanColumnState>>({})

    const register = (handle: KanbanColumnHandle) => {
        handles.set(handle.category, handle)
        columnStates[handle.category] = { settled: false, total: 0, firstError: '' }
    }

    /**
     * 反注册
     * @description 分组切换时新列可能先于旧列挂载 ⇒ 只在「当前句柄仍是自己」时才清理，
     *              避免旧列卸载把新列刚注册的摘要删掉
     */
    const unregister = (handle: KanbanColumnHandle) => {
        if (handles.get(handle.category) !== handle) return
        handles.delete(handle.category)
        delete columnStates[handle.category]
    }

    const report = (category: string, state: KanbanColumnState) => {
        const current = columnStates[category]
        if (!current) return
        current.settled = state.settled
        current.total = state.total
        current.firstError = state.firstError
    }

    const summary = computed<KanbanColumnSummary>(() => {
        const list = Object.values(columnStates)
        return {
            settled: list.length > 0 && list.every((state) => state.settled),
            total: list.reduce((sum, state) => sum + state.total, 0),
            firstError: list.find((state) => state.firstError)?.firstError ?? ''
        }
    })

    const resetAll = async () => {
        await Promise.all([...handles.values()].map((handle) => handle.reset()))
    }

    return { register, unregister, resetAll, report, summary }
}

/** 列注册表注入键（ADR 决策 1：唯一编排入口） */
export const KANBAN_COLUMN_PAGING_KEY: InjectionKey<KanbanColumnPaging> = Symbol(
    'KANBAN_COLUMN_PAGING_KEY'
)

/** 列内 `refreshToken` 计数（`RefreshData` ⇒ 各列回第 1 页）—— 便于调用方判类型 */
export type KanbanRefreshToken = Ref<number>