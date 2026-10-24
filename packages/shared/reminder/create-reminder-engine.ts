/**
 * 提醒引擎（调度 / 可见性 / 落账 / 消费，T527 / AC1–AC6 · AC8）
 * @description 依赖一律端口注入（不 import persistence-local / 不感知框架）：
 *              `listCandidates` → 判定 → `ledger.claim`（展示**前**落账）→ `notify` → `consume`（展示**后**消费）。
 *              调度 = 可见态 10s 轮询 + 最近一条未来提醒的精确定时；隐藏即停，改由
 *              `visibilitychange → visible` / `focus` / `online` 补扫（PRD §六 NFR）。
 */
import {
    collectDueReminders,
    isActiveReminderTask,
    parseReminderTime
} from './collect-due-reminders'
import { nextOccurrence } from './next-occurrence'
import type { ReminderEngine, ReminderEngineDeps, ReminderTask, TaskReminderEvent } from './types'

/** 轮询基准间隔（NFR「单一常量」；仅页面可见时运行） */
export const REMINDER_SCAN_INTERVAL_MS = 10_000

/** 精确定时提前量（ms）：补偿调度/查询耗时，保证不晚于 remindAt */
const PRECISE_LEAD_MS = 100

/** `setTimeout` 可接受的最大延时（超过则由轮询兜底） */
const MAX_TIMEOUT_MS = 2_147_483_647

/** 页面是否可见（无 document 环境 = 不可判定 ⇒ 视为可见） */
const isDocumentVisible = (): boolean =>
    typeof document === 'undefined' || document.visibilityState !== 'hidden'

/** 跨标签扫描锁名（同源共享） */
const SCAN_LOCK_NAME = 'nao-todo:reminder-scan'

/** Web Locks 最小形状（仅用 `ifAvailable` 互斥；不可用 ⇒ 降级 CAS） */
type LockManagerLike = {
    request(
        name: string,
        options: { ifAvailable: boolean },
        callback: (lock: unknown) => Promise<void>
    ): Promise<unknown>
}

/** 取 Web Locks（非安全上下文 / 老浏览器 / 非浏览器环境 ⇒ null） */
const getLockManager = (): LockManagerLike | null => {
    if (typeof navigator === 'undefined') return null
    const locks = (navigator as unknown as { locks?: LockManagerLike }).locks
    return locks && typeof locks.request === 'function' ? locks : null
}

/**
 * 创建提醒引擎
 * @param deps 端口（见 `ReminderEngineDeps`）
 */
export const createReminderEngine = (deps: ReminderEngineDeps): ReminderEngine => {
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let preciseTimer: ReturnType<typeof setTimeout> | null = null
    /** 进行中的扫描（并发调用共享同一轮，避免重复派发） */
    let inFlight: Promise<void> | null = null
    let started = false
    let permissionRequested = false
    /** 已注册的监听卸载函数（stop 时统一移除） */
    const disposers: Array<() => void> = []

    const clearPoll = (): void => {
        if (pollTimer === null) return
        clearInterval(pollTimer)
        pollTimer = null
    }

    const clearPrecise = (): void => {
        if (preciseTimer === null) return
        clearTimeout(preciseTimer)
        preciseTimer = null
    }

    /**
     * 为最近一条未来提醒设精确定时
     * @description 已到期的条目由轮询/即时扫描负责；这里只排最近的未来项。
     *              临近（≤ 提前量）时按剩余时间精确排，避免零延时自旋。
     */
    const schedulePrecise = (tasks: readonly ReminderTask[]): void => {
        clearPrecise()
        const now = deps.now()
        let nearest: number | null = null
        for (const task of tasks) {
            if (!isActiveReminderTask(task)) continue
            const timestamp = parseReminderTime(task.remindAt)
            if (timestamp === null || timestamp <= now) continue
            if (nearest === null || timestamp < nearest) nearest = timestamp
        }
        if (nearest === null) return
        const remaining = nearest - now
        const delay =
            remaining > PRECISE_LEAD_MS ? remaining - PRECISE_LEAD_MS : Math.max(1, remaining)
        preciseTimer = setTimeout(
            () => {
                preciseTimer = null
                void scan()
            },
            Math.min(delay, MAX_TIMEOUT_MS)
        )
    }

    /**
     * 本轮是否被抑制（免打扰）
     * @description 端口可选；抛错 ⇒ **fail-open**（视为不抑制）——设置读取失败绝不吞掉提醒。
     */
    const isSuppressed = (nowMs: number): boolean => {
        if (!deps.isSuppressed) return false
        try {
            return deps.isSuppressed(nowMs) === true
        } catch {
            return false
        }
    }

    /** 一轮扫描本体：失败静默（不落账、不派发），下轮恢复即可补（AC6） */
    const performScan = async (): Promise<void> => {
        let tasks: readonly ReminderTask[]
        try {
            tasks = await deps.listCandidates()
        } catch {
            return
        }
        const now = deps.now()
        // 免打扰抑制门（T531/AC4 · R2）：必须在 collect / claim **之前** ⇒ 静默期零副作用
        // （不落账、不通知、不消费；`remindAt` 不推进 ⇒ 时段结束后由既有轮询逐条补弹）。
        // 门抛错 ⇒ fail-open（设置读取失败不得吞掉提醒）。精确定时照旧排。
        if (isSuppressed(now)) {
            schedulePrecise(tasks)
            return
        }
        const due = collectDueReminders(tasks, now, (key) => deps.ledger.has?.(key) === true)

        for (const item of due) {
            // 顺序硬约束：先落账（跨标签/刷新唯一性），再通知，最后消费
            if (!deps.ledger.claim(item.key)) continue
            const event: TaskReminderEvent = {
                taskId: item.task.id,
                taskName: item.task.name,
                description: item.task.description ?? undefined,
                projectId: item.task.projectId,
                remindAt: item.task.remindAt ?? ''
            }
            try {
                await deps.notify(event)
            } catch {
                // 通知失败：账本已落（本键不再重复），跳过消费以免数据被静默改写
                continue
            }
            if (!deps.consume) continue
            try {
                await deps.consume(item.task.id, nextOccurrence(item.task, now))
            } catch {
                // 消费失败：提醒已展示，账本已落 ⇒ 不重复；下一轮轮询静默跳过
            }
        }
        schedulePrecise(tasks)
    }

    /**
     * 一轮扫描（可见性 + 跨标签互斥）
     * @description 同源多标签经 `navigator.locks`（`ifAvailable`）互斥：抢不到锁的标签本轮跳过，
     *              由持锁标签扫描；**账本 `claim` 仍是唯一性最终判据** ⇒ 无 Locks 环境自动降级为
     *              CAS 口径（读后写 + 内存兜底，允许极低概率重复，见报告 Q5）。
     */
    const runScan = async (): Promise<void> => {
        if (!isDocumentVisible()) return
        const locks = getLockManager()
        if (!locks) {
            await performScan()
            return
        }
        let ran = false
        try {
            await locks.request(SCAN_LOCK_NAME, { ifAvailable: true }, async (lock) => {
                if (!lock) return
                ran = true
                await performScan()
            })
        } catch {
            // Locks 异常（权限/实现差异）⇒ 降级 CAS 口径，不得因此漏提醒
            if (!ran) await performScan()
        }
    }

    /** 单轮扫描（并发去重，供 start 首轮 / 轮询 / rescan 共用） */
    function scan(): Promise<void> {
        if (inFlight) return inFlight
        inFlight = runScan().finally(() => {
            inFlight = null
        })
        return inFlight
    }

    const startPoll = (): void => {
        if (pollTimer !== null) return
        pollTimer = setInterval(() => {
            void scan()
        }, REMINDER_SCAN_INTERVAL_MS)
    }

    /** 隐藏即停轮询与精确定时（不承诺隐藏态准时，见 PRD §六） */
    const stopScheduling = (): void => {
        clearPoll()
        clearPrecise()
    }

    const handleVisibilityChange = (): void => {
        if (isDocumentVisible()) {
            startPoll()
            void scan()
            return
        }
        stopScheduling()
    }

    const handleResume = (): void => {
        if (!isDocumentVisible()) return
        startPoll()
        void scan()
    }

    const listen = (target: unknown, type: string, handler: () => void): void => {
        const emitter = target as {
            addEventListener?: (type: string, handler: () => void) => void
            removeEventListener?: (type: string, handler: () => void) => void
        }
        if (!emitter?.addEventListener) return
        emitter.addEventListener(type, handler)
        disposers.push(() => emitter.removeEventListener?.(type, handler))
    }

    /** 通知权限：start 时**仅调一次**，失败/被拒不抛错（AC6） */
    const requestPermissionOnce = (): void => {
        if (permissionRequested) return
        permissionRequested = true
        try {
            const result = deps.requestNotificationPermission?.()
            if (result && typeof (result as Promise<unknown>).then === 'function') {
                void (result as Promise<unknown>).catch(() => {})
            }
        } catch {
            // 浏览器不支持 / 拒绝：仅应用内弹窗
        }
    }

    const start = (): void => {
        requestPermissionOnce()
        if (started) {
            void scan()
            return
        }
        started = true
        listen(typeof document === 'undefined' ? undefined : document, 'visibilitychange', () =>
            handleVisibilityChange()
        )
        listen(typeof window === 'undefined' ? undefined : window, 'focus', () => handleResume())
        listen(typeof window === 'undefined' ? undefined : window, 'online', () => handleResume())

        if (!isDocumentVisible()) return
        startPoll()
        // 首轮扫描 = 冷启动补弹（AC4）
        void scan()
    }

    const stop = (): void => {
        started = false
        stopScheduling()
        while (disposers.length > 0) disposers.pop()?.()
    }

    const rescan = (): Promise<void> => scan()

    return { start, stop, rescan }
}