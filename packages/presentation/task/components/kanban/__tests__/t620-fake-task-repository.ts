import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { prioritySNMap, TASK_PRIORITIES } from '@nao-todo/domain-task'
import type { GetTasksOptions, GetTasksSortOptions } from '@nao-todo/shared/constants'
import type { Pagination } from '@nao-todo/shared/types/pagination'
import { vi } from 'vite-plus/test'

/**
 * `T620` 看板列内分页 —— **内存仓储**（fake `taskUseCase`）
 *
 * @description `DEF-126` 修法（ADR `docs/adr/2026-11-01-kanban-column-paging.md`）把列数据来源从
 *              「父级传入的 `tasks` 数组」改为「每列自持 `useTasksLoader` ⇒ `taskUseCase.list`」。
 *              原 harness 只 stub 了 `update`，故此处补齐 **分页查询面**，让组件级用例仍能落在
 *              「用户可见的列头 / 列内卡片 / 仓储入参」上，而不必知道 RD 内部实现形状。
 *
 * **刻意复刻的仓储语义（只复刻判据需要的部分，不做通用实现）**
 *   1. **分页**：`slice((page-1)*limit, page*limit)` + `{ total, page, limit, maxPage }`
 *      —— 与 `persistence-local/repos/task-repo-impl.ts` 同口径（含「删/移后偏移会跳条」的真实后果，
 *      `AC13` 用它做反证）。
 *   2. **结构过滤**：`state` / `priority` / `projectId` / `tagId` / `parentTaskId`（默认顶层）+
 *      默认排除已删 / 已归档 / 已放弃。
 *   3. **`priority` 含 `low` 时纳入脏值**（R-J / D1）：白名单（`TASK_PRIORITIES`）外的
 *      `null` / `''` / 未知串与 `low` 同档 —— 这是 RD 要复刻到真实仓储的口径（`AC12`）。
 *   4. **`update` 成功后 patch 本地库**（对齐 `domain-task/.../usecases/task.ts` 对 Pinia store 的
 *      patch）⇒ 拖拽后的重查会看到最新值（`AC8` / `AC13` 的前提）。
 *
 * ⛔ 边界：本文件**不判断**列条件该怎么拼（求交 or 覆盖）——那只由被测实现决定；fake 仓储
 *           只执行「收到的 options」。这样 `AC11` 才能把「覆盖筛选」的实现在用例里暴露出来。
 */

/** 每页条数（R-A：用户已定 `limit = 20`） */
export const KANBAN_PAGE_SIZE = 20

export type UpdateCall = { taskId: string; payload: Record<string, unknown> }

export type FakeTaskRepository = {
    /** 注入 `TaskKanban` / `KanbanViewAdapter` 的 `taskUseCase` */
    taskUseCase: TaskUseCase
    /** `list` spy（查询次数与入参判据：`AC4` 零增量 / `AC11` 求交） */
    list: ReturnType<typeof vi.fn>
    /** `update` spy（写载荷判据：`AC8` / `DEF-114` 既有断言） */
    update: ReturnType<typeof vi.fn>
    /** `list` 实际入参（按调用顺序） */
    listCalls: () => GetTasksOptions[]
    /** `update` 实际入参（按调用顺序） */
    updateCalls: () => UpdateCall[]
    /** 本地库当前内容（`getTask` 的数据源；拖拽 / 新增后反映最新值） */
    db: () => TaskViewObject[]
    /** 模拟「任务已落库」（新建场景）：置顶写入本地库，不自动通知视图 */
    insert: (task: TaskViewObject) => void
}

const cloneTask = (task: TaskViewObject): TaskViewObject => ({
    ...task,
    tags: [...task.tags],
    remindWeekdays: [...task.remindWeekdays]
})

/** 优先级语义序（单一来源 = domain `prioritySNMap`；白名单外按 `low` 档） */
const priorityRank = (priority: unknown): number =>
    (prioritySNMap as Record<string, number>)[String(priority)] ?? prioritySNMap.low

const isDirtyPriority = (priority: unknown): boolean =>
    !(TASK_PRIORITIES as readonly unknown[]).includes(priority)

const matchesOptions = (task: TaskViewObject, options: GetTasksOptions): boolean => {
    // 删除态：显式 true 只查已删；否则排除已删（仓储默认语义）
    if (options.isDeleted === true ? !task.deletedAt : Boolean(task.deletedAt)) return false
    // 归档态：includeArchived 优先；显式 true 只查归档；否则排除归档
    if (!options.includeArchived) {
        if (options.isArchived === true ? !task.archivedAt : Boolean(task.archivedAt)) return false
    }
    // 放弃态：显式 true 只查已放弃；否则排除
    if (options.isGivenUp === true ? !task.givenUpAt : Boolean(task.givenUpAt)) return false
    if ((task.parentTaskId ?? '') !== (options.parentTaskId ?? '')) return false
    if (options.state) {
        const states = options.state.split(',').filter(Boolean)
        if (!states.includes(task.state)) return false
    }
    if (options.priority) {
        const priorities = options.priority.split(',').filter(Boolean)
        // R-J：含 low ⇒ 白名单外的脏值与 low 同档
        const hit = priorities.includes(task.priority)
        const hitLowWithDirty = priorities.includes('low') && isDirtyPriority(task.priority)
        if (!hit && !hitLowWithDirty) return false
    }
    if (options.projectId !== undefined && (task.projectId ?? null) !== options.projectId) {
        return false
    }
    if (options.tagId !== undefined && !task.tags.includes(options.tagId)) return false
    return true
}

/** 排序（只复刻用例所需的字段：优先级语义序 + 其余按字符串比较；同值保持原序） */
const sortTasks = (tasks: TaskViewObject[], sort?: GetTasksSortOptions): TaskViewObject[] => {
    if (!sort?.field) return tasks
    const direction = sort.order === 'desc' ? -1 : 1
    return [...tasks].sort((a, b) => {
        if (sort.field === 'priority') {
            return (priorityRank(a.priority) - priorityRank(b.priority)) * direction
        }
        const av = (a as unknown as Record<string, unknown>)[sort.field]
        const bv = (b as unknown as Record<string, unknown>)[sort.field]
        if (av === bv) return 0
        if (av === null || av === undefined) return 1
        if (bv === null || bv === undefined) return -1
        return (
            String(av as string | number).localeCompare(String(bv as string | number)) * direction
        )
    })
}

/**
 * 创建内存仓储
 * @param seed 初始任务（会复制一份，避免用例 fixture 被仓储改动污染）
 * @param updateError `update` 返回码（`null` = 成功；非空 = 离线 / 只读等失败路径）
 */
export const createFakeTaskRepository = (
    seed: TaskViewObject[],
    updateError: string | null = null
): FakeTaskRepository => {
    const store: TaskViewObject[] = seed.map(cloneTask)
    const listCalls: GetTasksOptions[] = []
    const updateCalls: UpdateCall[] = []

    const list = vi.fn(async (options: GetTasksOptions) => {
        listCalls.push({
            ...options,
            sort: options.sort ? { ...options.sort } : undefined
        })
        const filtered = sortTasks(
            store.filter((task) => matchesOptions(task, options)),
            options.sort
        )
        const page = Math.max(1, Number(options.page) || 1)
        const limit = Math.max(1, Number(options.limit) || KANBAN_PAGE_SIZE)
        const total = filtered.length
        const maxPage = Math.max(1, Math.ceil(total / limit))
        const paged = filtered.slice((page - 1) * limit, page * limit)
        const pagination: Pagination = { total, page, limit, maxPage }
        return [{ taskIds: paged.map((task) => task.id), pagination }, null]
    })

    const update = vi.fn(async (taskId: string, payload: Record<string, unknown>) => {
        updateCalls.push({ taskId, payload: { ...payload } })
        if (updateError !== null) return updateError
        // 对齐 usecase：写成功后 patch store（后续重查看得到最新值）
        const task = store.find((item) => item.id === taskId)
        if (task) Object.assign(task, payload)
        return null
    })

    const useCase = {
        list,
        update,
        get: vi.fn(async (taskId: string) => {
            const task = store.find((item) => item.id === taskId)
            return task ? [cloneTask(task), null] : [null, '任务不存在']
        })
    }

    return {
        taskUseCase: useCase as unknown as TaskUseCase,
        list,
        update,
        listCalls: () => listCalls,
        updateCalls: () => updateCalls,
        db: () => store,
        insert: (task) => store.unshift(cloneTask(task))
    }
}