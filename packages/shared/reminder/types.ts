/**
 * 提醒本地轮询：共享类型（T527）
 * @description 引擎与接缝的公共形状。用例契约见 `__tests__/reminder-harness.ts`
 *              （导出清单 / deps 形状 / `claim → notify → consume` 顺序）。
 */
import type { TaskReminderEvent } from '../types/reminder'

export type { TaskReminderEvent }

/**
 * 本机候选任务
 * @description 只含判定所需字段（提醒配置 + 活跃态 + 展示文案），避免引擎依赖完整实体。
 *              `remindAt` 为 RFC3339（可能带偏移）或空/null。
 */
export type ReminderTask = {
    id: string
    name: string
    description?: string | null
    /** 清单标识（T531/AC8：弹窗按它经装配层解析清单名） */
    projectId: string
    remindAt: string | null
    remindRepeat?: string | null
    remindTime?: string | null
    /** weekly 位掩码（bit0=周日 … bit6=周六）或星期数组（1=周一 … 7=周日） */
    remindWeekdays?: number | readonly number[] | null
    endAt?: string | null
    state: string
    deletedAt?: string | null
    archivedAt?: string | null
    givenUpAt?: string | null
    parentTaskId?: string | null
}

/** 到期项：`key = \`${taskId}@${remindAt}\``（R2 单一去重键） */
export type DueReminder = {
    task: ReminderTask
    key: string
}

/**
 * 去重账本
 * @description `claim` 为**写侧**（展示前落账，同步/幂等/原子）；`has` 为**读侧**谓词，
 *              供 `collectDueReminders` 保持纯函数。
 */
export type ReminderLedger = {
    claim(key: string): boolean
    has(key: string): boolean
}

/**
 * 引擎账本端口
 * @description 引擎只用 `claim`；`has` 可选（提供则判定阶段可更早剪枝，缺省由 `claim` 兜底）。
 */
export type ReminderLedgerPort = {
    claim(key: string): boolean
    has?(key: string): boolean
}

/** 引擎依赖端口（一律注入：shared/presentation 不得 import persistence-local） */
export type ReminderEngineDeps = {
    /** 本机候选（未过滤活跃态，由 `collectDueReminders` 过滤）；失败 ⇒ reject */
    listCandidates(): Promise<readonly ReminderTask[]>
    /** 校准后的本机毫秒时间戳（R8：与本地写时间戳同源） */
    now(): number
    /** 展示**前**落账 */
    ledger: ReminderLedgerPort
    /** 应用内弹窗 + 系统通知（适配层） */
    notify(event: TaskReminderEvent): void | Promise<void>
    /** 展示**后**消费：`null` = 清空提醒；否则为下一次 ISO（R6） */
    consume?(taskId: string, nextRemindAt: string | null): void | Promise<void>
    /** `start` 时**仅调一次**（AC6：通知权限被拒不重复索权） */
    requestNotificationPermission?(): void | Promise<unknown>
    /**
     * 免打扰抑制门（T531/AC4 · R2）
     * @description 每轮扫描在 `collectDueReminders` / `claim` **之前**调用一次；返回 true ⇒
     *              本轮零副作用（不落账、不通知、不消费），提醒留待下次扫描补弹。
     *              抛错 ⇒ **fail-open**（视为不抑制，提醒照常）；未注入 ⇒ 与旧行为完全一致。
     */
    isSuppressed?(nowMs: number): boolean
}

/** 引擎句柄 */
export type ReminderEngine = {
    start(): void
    stop(): void
    rescan(): Promise<void>
}