import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'

/**
 * 任务是否逾期（天级口径，与任务页「已过期」一致）
 * @description endAt < 今日 0 点且未完成；endAt 为空/非法或已完成一律不判逾期。
 *              纯函数模块：task-bar / day-drawer 直接引用，不拉入 use-calendar-monthly 依赖链（O5 解耦）。
 */
export const isTaskOverdue = (task: TaskViewObject): boolean => {
    if (task.state === 'done' || !task.endAt) return false
    const end = dayjs(task.endAt)
    return end.isValid() && end.isBefore(dayjs().startOf('day'))
}