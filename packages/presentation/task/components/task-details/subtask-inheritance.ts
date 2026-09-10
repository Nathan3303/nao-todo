import dayjs from 'dayjs'
import type { CreateTaskViewObject } from '@nao-todo/domain-task'
import type { TaskDetailsViewObject } from './types'

/**
 * 解析子任务创建参数（从父任务继承清单与时间窗）
 * @description TASK-01（ADR `2026-09-10-task-01-subtask-inherit.md` §3）：**以 `endAt` 为锚**的窗口拷贝。
 *              - 仅继承 `projectId`/`startAt`/`endAt`（C-T1），其余字段保持既有默认值（R6）
 *              - **值快照**：原样使用父值，禁任何时区/粒度/格式重算（C-T2）
 *              - `startAt`/`endAt` **一律显式给值（含 `null`）**，禁省略为 `undefined`（C-T3：
 *                `dayjs(undefined)` = 当前时刻 ⇒ 未来 `startAt` 会被误判 `START_AFTER_END`）
 *              - 父 VO 不可得 ⇒ 未安排 + 清单缺失，不抛错（C-T4，理论上不可达）
 *              - **不调用**领域层 `CreateTaskValueObject.fillStartAt()`（该方法是全仓零调用点的死方法）：
 *                仅 `endAt` 场景下 `startAt` 就是 `null`，与既有 endAt-only 创建行为一致
 *              - 继承规则：两者皆有效且 `start ≤ end` ⇒ 逐字拷贝两者；仅 `endAt` ⇒ 拷贝 `endAt` 且
 *                `startAt = null`；仅 `startAt` / 皆无 / 无效 / `start > end` ⇒ 两者皆 `null`（未安排）
 * @param parent 父任务详情视图对象（未就绪为 null）
 * @param name 子任务名称
 * @param parentTaskId 父任务 ID
 * @returns 交给 `TaskUseCase.create` 的完整视图对象参数
 */
export const resolveSubTaskDraft = (
    parent: TaskDetailsViewObject | null,
    name: string,
    parentTaskId: string
): CreateTaskViewObject => {
    // 清单原样拷贝（`''` 与 `null` 均由既有 converter 承接为收集箱）
    const projectId = parent?.projectId ?? null
    const parentStartAt = parent?.startAt ?? null
    const parentEndAt = parent?.endAt ?? null

    // 以 endAt 为锚：无有效 endAt ⇒ 未安排（两者皆 null）
    let startAt: string | null = null
    let endAt: string | null = null
    if (parentEndAt && dayjs(parentEndAt).isValid()) {
        if (!parentStartAt) {
            // 仅 endAt ⇒ 拷贝 endAt；startAt 保持 null（不派生）
            endAt = parentEndAt
        } else if (
            dayjs(parentStartAt).isValid() &&
            !dayjs(parentStartAt).isAfter(dayjs(parentEndAt))
        ) {
            // 两者皆有效且 start ≤ end ⇒ 逐字拷贝两者（值快照，不做任何重算）
            startAt = parentStartAt
            endAt = parentEndAt
        }
        // 其余（startAt 无效 / start > end）⇒ 保持未安排（两者皆 null）
    }

    return {
        parentTaskId,
        projectId,
        name,
        description: '',
        state: 'todo',
        priority: 'low',
        startAt,
        endAt,
        tags: [],
        remindAt: null,
        remindRepeat: 'none',
        remindTime: null,
        remindWeekdays: []
    }
}