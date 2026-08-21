import {
    TASK_REMINDER_DIALOG_KEY,
    sendNotification,
    t,
    type SSEReminderEvent
} from '@nao-todo/shared'
import type { DialogManager } from '@nao-todo/shared'
import { LocalTaskRepoImpl } from '@nao-todo/infrastructure'

/**
 * 本地任务提醒扫描器
 * @description 桌面版替代远程 SSE 提醒：按 remindAt 精确调度扫描本地任务，
 *              到期触发与 Web 端一致的任务提醒 UI 组件（TASK_REMINDER_DIALOG_KEY）
 *              并发送系统通知。
 *              去重键为 `taskId@remindAt`：Snooze 后 remindAt 变化视为新提醒再次触发。
 *              精确 setTimeout（毫秒级）+ 兜底 setInterval（覆盖新建/改 remindAt 后调度未重置）。
 */
const FALLBACK_INTERVAL_MS = 10_000
/** 提前量（ms）：补偿调度/查询耗时，保证通知不晚于 remindAt */
const AHEAD_BUFFER_MS = 100

export const useLocalReminder = (dialogManager: DialogManager) => {
    const taskRepo = new LocalTaskRepoImpl()
    const notifiedKeys = new Set<string>()
    let fallbackTimer: ReturnType<typeof setInterval> | null = null
    let preciseTimer: ReturnType<typeof setTimeout> | null = null

    /** 通知单个到期任务（UI 组件 + 系统通知，与 Web 端 SSE 提醒行为一致） */
    const notify = (task: { id: string; name: string; description?: string }) => {
        const event: SSEReminderEvent = {
            taskId: task.id,
            taskName: task.name,
            description: task.description
        }
        dialogManager.open(TASK_REMINDER_DIALOG_KEY, event)
        // 系统通知仅显示任务名称（不含描述，见需求）
        sendNotification(t('task.reminder.title'), task.name)
    }

    /** 扫描一轮到期提醒 */
    const scan = async () => {
        const [result, err] = await taskRepo.list('isDeleted=false')
        if (err !== null) return
        const now = Date.now()
        let nextRemindAt: number | null = null
        for (const task of result.taskEntities) {
            if (!task.remindAt) continue
            const remindTs = new Date(task.remindAt).getTime()
            // 去重键含 remindAt 版本：Snooze 后 remindAt 更新 → 视为新提醒再次触发
            const notifyKey = `${task.id}@${task.remindAt}`
            if (notifiedKeys.has(notifyKey)) continue
            if (remindTs > now) {
                // 记录最近未到期提醒，用于精确调度
                if (nextRemindAt === null || remindTs < nextRemindAt) nextRemindAt = remindTs
                continue
            }
            notifiedKeys.add(notifyKey)
            notify(task)
        }
        // 精确调度下一个最近提醒（提前 AHEAD_BUFFER_MS 触发，扫描本身幂等）
        if (preciseTimer !== null) {
            clearTimeout(preciseTimer)
            preciseTimer = null
        }
        if (nextRemindAt !== null) {
            preciseTimer = setTimeout(
                () => void scan(),
                Math.max(0, nextRemindAt - now - AHEAD_BUFFER_MS)
            )
        }
    }

    /** 重新扫描（任务变更/snooze 后立即重算精确调度，无需等兜底轮询） */
    const rescan = () => {
        void scan()
    }

    /**
     * 启动扫描
     */
    const start = () => {
        if (fallbackTimer !== null) return
        // 请求通知权限（Electron 中默认授予）
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission()
        }
        void scan()
        // 兜底轮询：覆盖任务新建/remindAt 变更后精确调度未重置的场景
        fallbackTimer = setInterval(() => void scan(), FALLBACK_INTERVAL_MS)
    }

    /**
     * 停止扫描
     */
    const stop = () => {
        if (fallbackTimer !== null) {
            clearInterval(fallbackTimer)
            fallbackTimer = null
        }
        if (preciseTimer !== null) {
            clearTimeout(preciseTimer)
            preciseTimer = null
        }
    }

    return { start, stop, rescan }
}