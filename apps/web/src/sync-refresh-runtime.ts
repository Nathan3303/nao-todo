import {
    createAutoRefreshController,
    type AutoRefreshController,
    type AutoRefreshPullOutcome,
    type AutoRefreshTrigger
} from '@nao-todo/infrastructure/src/persistence-sync/auto-refresh'
import {
    createPullBroadcast,
    type PullBroadcast
} from '@nao-todo/infrastructure/src/persistence-sync/pull-broadcast'
import { syncService } from '@nao-todo/infrastructure/src/persistence-sync/sync-service'
import { syncTracker } from '@nao-todo/infrastructure/src/persistence-sync/sync-tracker'
import type { SyncRunResult } from '@nao-todo/infrastructure/src/persistence-sync/sync-status'
import { localSession } from '@nao-todo/infrastructure/src/persistence-local/session/local-session'
import {
    logStructured,
    STRUCTURED_LOG_EVENTS
} from '@nao-todo/infrastructure/src/observability/structured-log'

/**
 * 同步感知 A′ 运行接线（T654 / PRD `2026-11-05-sync-perception-polling.md`）
 *
 * @description 把纯门控层（`auto-refresh`）接到真实运行环境：
 *              - **周期 30s**：窗口可见且空闲时拉取（经 `syncService.pullAll` 串行入口）；
 *              - **可见性信号**：web = `document.visibilityState`；desktop = 主进程 `hide`/`show`
 *                → IPC（`manageDocumentVisibility: false`，⛔ 桌面不得用 `visibilityState` 冒充，
 *                `backgroundThrottling:false` 下它恒为 `visible`，R-10）；
 *              - **在线信号**：`online` / `offline`（恢复联网立即拉一次；离线不建定时器）；
 *              - **单主 + 广播**：锁在 `SyncService`（`navigator.locks`），本层订阅
 *                `pull-broadcast` ⇒ 非主标签**只刷新视图**、不发第二次网络（R-6 / AC7）。
 *
 *              ⛔ 本模块不参与任何数据裁决（OCC / base / 冲突落账 / `pull-local-wins` 零改动），
 *              只是「何时调一次既有入口」。文案零新增（无用户可见面）。
 */

/** 运行接线句柄（由装配层控制可见性 / 离线 / 释放） */
export interface SyncRefreshRuntime {
    /** 可见性信号（隐藏 ⇒ 停周期；显示 ⇒ 立即拉一次，合并门在服务内） */
    setVisible(visible: boolean): void
    /** 离线信号（离线 ⇒ 停周期；恢复 ⇒ 立即拉一次） */
    setOffline(offline: boolean): void
    /** 释放定时器 / 监听 / 广播（卸载 / 登出 / 凭证失效） */
    dispose(): void
    isDisposed(): boolean
}

export interface SyncRefreshRuntimeOptions {
    /**
     * 首次可见性（desktop 缺省 true，随后由 IPC 首帧消息纠正；web 缺省看 `document`）
     */
    initialVisible?: boolean
    /**
     * 是否由本层注册 `document.visibilitychange`（web 缺省 true）
     * @description desktop 必须传 `false`：桌面可见性唯一信号 = 主进程 IPC（R-10）
     */
    manageDocumentVisibility?: boolean
    /** 每次拉取结束回调（web 用于清除「离线进入」只读标记；不得抛错） */
    onRunResult?(result: SyncRunResult): void
}

/** 当前可见性（无 document 环境视为可见） */
const readVisible = (): boolean =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'

/** 当前是否离线（无 navigator 环境视为在线） */
const readOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false

const createRuntime = (options: SyncRefreshRuntimeOptions): { handle: SyncRefreshRuntime } => {
    let visible = options.initialVisible ?? readVisible()
    let offline = readOffline()

    const broadcast: PullBroadcast = createPullBroadcast()
    let unsubscribeBroadcast: () => void = () => {}
    /** 自引用句柄（`dispose` 需要判断自己是否仍是当前运行实例） */
    const holder: { handle: SyncRefreshRuntime } = { handle: null as unknown as SyncRefreshRuntime }

    const pull = async (trigger: AutoRefreshTrigger): Promise<AutoRefreshPullOutcome> => {
        // 无会话 ⇒ 零请求（登出后定时器可能尚未清掉，这里再兜一层）
        const userId = localSession.getCurrentUserId()
        if (!userId) return { ok: true }
        let result: SyncRunResult
        try {
            result =
                trigger === 'periodic'
                    ? await syncService.pullAll()
                    : // 事件触发走既有恢复入口（内含 R-9 合并门，只推不拉也由它决定）
                      await syncService.resumeBackfill()
        } catch {
            return { ok: false }
        }
        try {
            options.onRunResult?.(result)
        } catch {
            // 回调不得影响门控
        }
        if (result.credentialFailure) return { ok: false, stop: true }
        return { ok: result.ok }
    }

    const controller: AutoRefreshController = createAutoRefreshController({
        pull,
        hasPendingLocalWrites: async () => (await syncTracker.countDirty()) > 0,
        isVisible: () => visible,
        isOffline: () => offline,
        setTimeout: (handler, delayMs) => globalThis.setTimeout(handler, delayMs),
        clearTimeout: (timer) => globalThis.clearTimeout(timer),
        onFailure: ({ trigger, failures, delayMs }) => {
            logStructured('warn', STRUCTURED_LOG_EVENTS.SYNC_AUTO_REFRESH_FAILED, {
                userId: localSession.getCurrentUserId() ?? undefined,
                trigger,
                failures,
                delayMs
            })
        }
    })

    /** 广播命中：同用户 ⇒ 只刷新本窗口视图（AC7 ≤2s；无网络） */
    unsubscribeBroadcast = broadcast.subscribe((message) => {
        const userId = localSession.getCurrentUserId()
        if (!userId || message.userId !== userId) return
        logStructured('info', STRUCTURED_LOG_EVENTS.SYNC_AUTO_REFRESH_BROADCAST, { userId })
        void syncService.applyForeignPullComplete(message.at)
    })

    const detach: (() => void)[] = []
    if (typeof window !== 'undefined') {
        const onOnline = (): void => {
            offline = false
            controller.setOffline(false)
        }
        const onOffline = (): void => {
            offline = true
            controller.setOffline(true)
        }
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        detach.push(() => window.removeEventListener('online', onOnline))
        detach.push(() => window.removeEventListener('offline', onOffline))
    }
    if (options.manageDocumentVisibility !== false && typeof document !== 'undefined') {
        const onVisibilityChange = (): void => {
            visible = readVisible()
            controller.setVisible(visible)
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        detach.push(() => document.removeEventListener('visibilitychange', onVisibilityChange))
    }

    controller.start()

    holder.handle = {
        setVisible: (next) => {
            visible = next
            controller.setVisible(next)
        },
        setOffline: (next) => {
            offline = next
            controller.setOffline(next)
        },
        dispose: () => {
            for (const fn of detach.splice(0)) fn()
            controller.dispose()
            unsubscribeBroadcast()
            unsubscribeBroadcast = () => {}
            broadcast.dispose()
            if (current === holder) current = null
        },
        isDisposed: () => controller.isDisposed()
    }

    return holder
}

/** 当前运行接线（整应用生命周期内至多一个） */
let current: { handle: SyncRefreshRuntime } | null = null

/**
 * 启动同步自动刷新（幂等：已启动则返回同一句柄）
 * @description 无 `window`（node / SSR / 纯单测）⇒ 不启动，返回 `null`（零定时器、零监听）。
 */
export const startSyncRefreshRuntime = (
    options: SyncRefreshRuntimeOptions = {}
): SyncRefreshRuntime | null => {
    if (current) return current.handle
    if (typeof window === 'undefined') return null
    const holder = createRuntime(options)
    current = holder
    return holder.handle
}

/** 关闭自动刷新（卸载 / 登出）；未启动 ⇒ no-op */
export const stopSyncRefreshRuntime = (): void => {
    const running = current
    current = null
    running?.handle.dispose()
}

/** 是否已启动（测试/诊断用） */
export const isSyncRefreshRuntimeRunning = (): boolean => current !== null