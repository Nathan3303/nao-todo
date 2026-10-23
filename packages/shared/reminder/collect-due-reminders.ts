/**
 * 到期判定（纯核心，T527 / AC1 · AC3 · AC6 · AC7）
 * @description 无副作用：所有过滤与排序都在内存中完成，落账由引擎端口负责。
 *              契约见 `__tests__/reminder-harness.ts`（导出 2）。
 */
import type { DueReminder, ReminderTask } from './types'

/**
 * 解析提醒时间
 * @description RFC3339 可能带时区偏移 ⇒ 必须**解析后比较**（字符串比较不可靠）；非法/缺失 ⇒ null
 */
export const parseReminderTime = (value: string | null | undefined): number | null => {
    if (!value) return null
    const timestamp = new Date(value).getTime()
    return Number.isFinite(timestamp) ? timestamp : null
}

/**
 * 活跃态判定（对齐 ADR D1）
 * @description 排除删除 / 归档 / 放弃 / 完成；**不过滤子任务**（`parentTaskId` 非空照常提醒）
 */
export const isActiveReminderTask = (task: ReminderTask): boolean =>
    !task.deletedAt && !task.archivedAt && !task.givenUpAt && task.state !== 'done'

/** 去重键：`taskId@remindAt`（R2；Snooze 改写 remindAt ⇒ 键变 ⇒ 新条目，R3） */
export const reminderKey = (task: ReminderTask): string => `${task.id}@${task.remindAt ?? ''}`

/**
 * 收集到期提醒
 * @param tasks 本机候选（未过滤活跃态）
 * @param now 本机（校准后）毫秒时间戳
 * @param isClaimed 读侧谓词：该键已落账 ⇒ true
 * @returns 到期项，按 remindAt 升序；同刻保持入参顺序（稳定）
 */
export const collectDueReminders = (
    tasks: readonly ReminderTask[],
    now: number,
    isClaimed: (key: string) => boolean
): readonly DueReminder[] => {
    const due: Array<DueReminder & { timestamp: number }> = []
    for (const task of tasks) {
        if (!isActiveReminderTask(task)) continue
        const timestamp = parseReminderTime(task.remindAt)
        // 闭区间：remindAt <= now 即到期；非法时间不参与（避免脏数据被记成已交付）
        if (timestamp === null || timestamp > now) continue
        const key = reminderKey(task)
        if (isClaimed(key)) continue
        due.push({ task, key, timestamp })
    }
    // Array#sort 自 ES2019 起稳定 ⇒ 同刻保持入参顺序
    due.sort((a, b) => a.timestamp - b.timestamp)
    return due.map(({ task, key }) => ({ task, key }))
}