/**
 * 提醒派发适配层（T531 · AC2 / AC3 / AC8 / AC10）
 *
 * @description 把「应用内弹窗 + 系统通知」从 `index-view.ts` 的内联回调抽成可单测的薄装配层
 *              （零新依赖：只搬逻辑，不新增通道）。口径：
 *              - **应用内弹窗恒开**（通知开关只关系统通知）；先弹窗、再发通知；
 *              - `silent = !settings.sound`；正文 = `任务名 · 清单名`（清单名解析不到 ⇒ 只留任务名）；
 *              - 点击通知 ⇒ `onOpenTask(taskId)`（聚焦由 `sendNotification` 自身负责）；
 *              - **永不抛**：设置读取 / 通知发送 / 清单名解析任一失败都降级 —— 否则引擎
 *                `claim` 已落、`consume` 未执行 ⇒ 该条永久不再提醒（AC10 / T530 终签 C2）。
 * @see docs/prds/2026-10-24-reminder-settings.md（§五 R5/R6 · §七 AC2/AC3/AC8/AC10）
 */
import {
    DEFAULT_REMINDER_SETTINGS,
    type ReminderSettings,
    type TaskReminderEvent
} from '@nao-todo/shared/reminder'
import { t } from '@nao-todo/shared/locales'

export type ReminderNotifySendOptions = {
    silent?: boolean
    onClick?: () => void
}

export type ReminderNotifyDeps = {
    /** 应用内弹窗（恒开） */
    openDialog(event: TaskReminderEvent): void
    /** 系统通知（`sendNotification`：永不抛、返回是否已交付） */
    send(title: string, body: string, options: ReminderNotifySendOptions): unknown
    /** 本地身份级设置读取（适配层内部兜底抛错 ⇒ 默认设置） */
    readSettings(): ReminderSettings
    /** 清单名解析（装配层注入；解析不到 / 抛错 ⇒ 只留任务名） */
    resolveProjectName?(projectId: string): string | null | undefined
    /** 点击系统通知后的跳转（装配层注入；缺失 ⇒ 静默） */
    onOpenTask?(taskId: string): void
}

/** 清单名（失败 / 空串 ⇒ null，避免拼出悬空分隔符） */
const resolveProjectName = (
    deps: ReminderNotifyDeps,
    projectId: string | undefined
): string | null => {
    if (!deps.resolveProjectName || !projectId) return null
    try {
        const name = deps.resolveProjectName(projectId)
        return typeof name === 'string' && name.trim() !== '' ? name : null
    } catch {
        return null
    }
}

/**
 * 创建提醒派发函数（引擎 `notify` 端口）
 * @param deps 派发依赖（弹窗 / 通知 / 设置 / 清单名 / 跳转）
 */
export const createReminderNotify = (deps: ReminderNotifyDeps) => {
    const readSettings = (): ReminderSettings => {
        try {
            return deps.readSettings()
        } catch {
            // 设置读不到 ⇒ fail-open（按默认：发通知、有声音），提醒不得因此丢失
            return DEFAULT_REMINDER_SETTINGS
        }
    }

    return (event: TaskReminderEvent): void => {
        // ① 应用内弹窗：恒开，且先于系统通知（通知失败不影响「已展示」的事实）
        try {
            deps.openDialog(event)
        } catch {
            /* 弹窗层异常不得冒到引擎（引擎责任边界见 AC10） */
        }

        // ② 系统通知：受通知开关控制；声音经 silent 控制
        const settings = readSettings()
        if (!settings.notify) return
        const projectName = resolveProjectName(deps, event.projectId)
        const body = projectName ? `${event.taskName} · ${projectName}` : event.taskName
        try {
            deps.send(t('task.reminder.title'), body, {
                silent: !settings.sound,
                onClick: () => deps.onOpenTask?.(event.taskId)
            })
        } catch {
            // 通知适配层理应用值返回；此处再兜一层，保证「通知失败 ≠ 提醒丢失」
        }
    }
}