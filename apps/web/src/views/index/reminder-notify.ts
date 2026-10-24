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
 *              - **C3（T531 终签）**：权限 `granted` 但发送返回「未送达」（Android Chrome 页面通知）
 *                ⇒ 回灌**设备级**降级标记，让设置区显示「不支持」而非假的「已开启」。
 * @see docs/prds/2026-10-24-reminder-settings.md（§五 R5/R6 · §七 AC2/AC3/AC8/AC9/AC10）
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
    /**
     * 通知权限来源（默认读全局 `Notification.permission`）
     * @description 仅 `granted` 才可能是「以为能用但实际发不出」⇒ 才写降级标记。
     */
    getNotificationPermission?(): string | null
    /**
     * 记录「权限已授予但发不出」的设备级降级标记（装配层注入；已幂等）
     * @description 供设置区把状态显示为「不支持」（声音置灰），刷新 / 登出后仍在。
     */
    markNotifyUnsupported?(): void
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

/** 当前通知权限（注入优先；全局不可用 / 抛错 ⇒ null） */
const currentPermission = (deps: ReminderNotifyDeps): string | null => {
    try {
        if (deps.getNotificationPermission) return deps.getNotificationPermission()
        return typeof Notification === 'undefined' ? null : Notification.permission
    } catch {
        return null
    }
}

/**
 * 创建提醒派发函数（引擎 `notify` 端口）
 * @param deps 派发依赖（弹窗 / 通知 / 设置 / 清单名 / 跳转 / 能力降级）
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
            const delivered = deps.send(t('task.reminder.title'), body, {
                silent: !settings.sound,
                onClick: () => deps.onOpenTask?.(event.taskId)
            })
            // C3：权限已授予却发不出（Android Chrome 页面通知被禁用）⇒ 记设备级降级标记
            // （幂等由 `markNotifyUnsupported` 实现保证；标记写失败不得影响派发）
            if (delivered === false && currentPermission(deps) === 'granted') {
                try {
                    deps.markNotifyUnsupported?.()
                } catch {
                    /* 降级标记写入失败：本会话设置区仍能经内存态感知 */
                }
            }
        } catch {
            // 通知适配层理应用值返回；此处再兜一层，保证「通知失败 ≠ 提醒丢失」
        }
    }
}