import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import {
    STRUCTURED_LOG_EVENTS,
    clearStructuredLog,
    readStructuredLog
} from '../../observability/structured-log'
import {
    AUTO_REFRESH_INTERVAL_MS,
    createAutoRefreshController,
    type AutoRefreshTimerHandle
} from '../auto-refresh'
import { setJWTTokenProvider } from '../../persistence-go/utils'
import { createPullBroadcast, type PullBroadcastChannelLike } from '../pull-broadcast'
import { syncStatus } from '../sync-status'
import { SyncService } from '../sync-service'

/**
 * T657 · DEF-140 —— `/sync/pull` 收到「业务码 + 无 `data`」不得当空拉取成功
 *
 * @description 修前：`inner = data?.data?.data ?? {}` ⇒ 逐表 `pending.delete` ⇒ `pending.size===0`
 *              ⇒ `markMirrorPulled()` ⇒ `runFull` 返回 `ok:true` ⇒ 界面「已是最新」假绿，
 *              且 T654 自动刷新门控被骗（不退避、继续 30s、还向其他标签广播「已拉取」）。
 *              本文件覆盖**四态**（缺一不可）+ 老形状兼容：
 *              ① `10051`（限流）→ 失败 + 不推进 + 不广播 + 走退避
 *              ② `90022`（拒绝）  → 同上
 *              ③ `10041`（凭证）  → 既有鉴权路径（不混进业务退避）
 *              ④ `90020 + 空表`   → 成功 + 推进 + 广播
 *              ⑤ 老形状（有表信袋、缺 `code`）→ 仍成功（不回归）
 * @see docs/prds/2026-11-05-sync-perception-polling.md（§八 上线闭环 / AC9 口径）
 */

const USER_ID = 'test-user'
/**
 * 固定「当前 token」：让 10041 代表**当前**凭证失效（否则被判为陈旧快照而只记日志）。
 * 与 `sync.test.ts` 同口径（node 环境无 localStorage）。
 */
const CURRENT_JWT = 'jwt-test-current'
setJWTTokenProvider(() => CURRENT_JWT)

const resetLocalState = async (): Promise<void> => {
    await localDatabase.projects.clear()
    await localDatabase.projectPreferences.clear()
    await localDatabase.tags.clear()
    await localDatabase.tagPreferences.clear()
    await localDatabase.tasks.clear()
    await localDatabase.taskCheckItems.clear()
    await localDatabase.taskComments.clear()
    await localDatabase.pomodoros.clear()
    await localDatabase.pomodoroRecords.clear()
    await localDatabase.users.clear()
    await localDatabase.userConfigs.clear()
    await localDatabase.meta.clear()
    await localDatabase.deletionSchedules.clear()
    await localDatabase.syncQueue.clear()
    await localDatabase.syncCursor.clear()
    cryptoService.lock()
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
}

/** 只回 `/sync/pull` 的替身（响应形状由用例给） */
const pullRequester = (
    pullResponse: () => unknown
): { requester: Requester; pulls: () => number } => {
    let pulls = 0
    const requester = {
        post: async (url: string) => {
            if (url === '/sync/pull') {
                pulls += 1
                return pullResponse()
            }
            return { data: { results: [] }, serverTime: Date.now() }
        },
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    } as unknown as Requester
    return { requester, pulls: () => pulls }
}

/** 假 `BroadcastChannel`（投递给其它实例，便于断言「有没有广播」） */
class FakeBroadcastChannel implements PullBroadcastChannelLike {
    static instances: FakeBroadcastChannel[] = []
    private listeners = new Set<(event: { data: unknown }) => void>()
    closed = false
    constructor(public readonly name: string) {
        FakeBroadcastChannel.instances.push(this)
    }
    postMessage(message: unknown): void {
        for (const target of FakeBroadcastChannel.instances) {
            if (target === this || target.closed) continue
            for (const listener of target.listeners) listener({ data: message })
        }
    }
    addEventListener(_type: 'message', listener: (event: { data: unknown }) => void): void {
        this.listeners.add(listener)
    }
    removeEventListener(_type: 'message', listener: (event: { data: unknown }) => void): void {
        this.listeners.delete(listener)
    }
    close(): void {
        this.closed = true
    }
}

/** 手动定时器（只影响门控层，不影响 IndexedDB） */
const createManualTimer = (): {
    setTimeout: (fn: () => void, delayMs: number) => AutoRefreshTimerHandle
    clearTimeout: (handle: AutoRefreshTimerHandle) => void
    lastDelay: () => number | null
    fire: () => Promise<void>
} => {
    let pending: { fn: () => void; delayMs: number } | null = null
    return {
        setTimeout: (fn, delayMs) => {
            pending = { fn, delayMs }
            return 1
        },
        clearTimeout: () => {
            pending = null
        },
        lastDelay: () => pending?.delayMs ?? null,
        fire: async () => {
            const task = pending
            pending = null
            task?.fn()
            for (let i = 0; i < 30; i += 1) await new Promise((resolve) => setTimeout(resolve, 10))
        }
    }
}

const describePullFailure = (
    label: string,
    response: () => unknown,
    expectedError: string
): void => {
    it(`${label} ⇒ 失败（不推进新鲜度 / 不广播 / 游标不前进）`, async () => {
        const { requester, pulls } = pullRequester(response)
        const service = new SyncService(requester)
        const broadcast = createPullBroadcast()
        const received: unknown[] = []
        broadcast.subscribe((message) => received.push(message))

        const before = syncStatus.get()
        const cursorsBefore = await localDatabase.syncCursor.toArray()

        const result = await service.pullAll()

        expect(pulls()).toBe(1)
        expect(result.ok).toBe(false)
        expect(result.lastError).toBe(expectedError)
        expect(result.credentialFailure).toBe(false)
        // ① 不推进新鲜度（界面不得显示「已是最新」）
        const after = syncStatus.get()
        expect(after.mirrorPulledAt).toBe(before.mirrorPulledAt)
        expect(after.syncing).toBe(false)
        // ② 不推进合并门时间（T654 门控不被骗）
        expect(service.getLastSuccessfulPullAt()).toBeNull()
        // ③ 不广播「已拉取」
        expect(received).toEqual([])
        // ④ 游标不前进（后续成功拉取仍从原位置续拉）
        expect(await localDatabase.syncCursor.toArray()).toEqual(cursorsBefore)
        // ⑤ 结构化失败日志（business 类，非网络/凭证）
        const failed = readStructuredLog().filter(
            (entry) => entry.event === STRUCTURED_LOG_EVENTS.SYNC_PULL_FAILED
        )
        expect(failed.length).toBeGreaterThan(0)
        expect(failed.at(-1)?.fields.kind).toBe('business')
        broadcast.dispose()
    })
}

describe('T657 · DEF-140 拉取响应判定（四态）', () => {
    beforeEach(async () => {
        FakeBroadcastChannel.instances = []
        vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
        vi.stubGlobal('navigator', {})
        clearStructuredLog()
        await resetLocalState()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
        FakeBroadcastChannel.instances = []
    })

    describe('① 10051（限流）：业务失败 + 走既有退避', () => {
        describePullFailure(
            '10051 + 无 data',
            () => ({ data: { code: 10051, message: '请求过于频繁' } }),
            '拉取失败：请求过于频繁，请稍后再试'
        )

        it('10051 ⇒ 自动刷新门控走退避（下一次 5s，而非继续 30s）', async () => {
            const { requester } = pullRequester(() => ({
                data: { code: 10051, message: '请求过于频繁' }
            }))
            const service = new SyncService(requester)
            const timer = createManualTimer()
            const controller = createAutoRefreshController({
                pull: async () => {
                    const result = await service.pullAll()
                    return { ok: result.ok, stop: result.credentialFailure }
                },
                hasPendingLocalWrites: async () => false,
                isVisible: () => true,
                isOffline: () => false,
                setTimeout: timer.setTimeout,
                clearTimeout: timer.clearTimeout
            })

            controller.start()
            expect(timer.lastDelay()).toBe(AUTO_REFRESH_INTERVAL_MS)

            await timer.fire() // 30s 到点 ⇒ 拉取失败
            expect(timer.lastDelay()).toBe(5_000) // 退避第一档（既有表）
            controller.dispose()
        })
    })

    describe('② 90022（拒绝）：与 10051 同口径', () => {
        describePullFailure(
            '90022 + 无 data',
            () => ({ data: { code: 90022, message: '请求被拒绝' } }),
            '拉取失败：数据异常'
        )
    })

    describe('③ 10041（凭证）：保持既有鉴权路径，不混进业务退避', () => {
        it('10041 ⇒ credentialFailure=true + 触发会话失效回调，不记业务错误', async () => {
            const { requester } = pullRequester(() => ({
                data: { code: 10041, message: '用户凭证验证失败' }
            }))
            const service = new SyncService(requester)
            const expired = vi.fn()
            service.setSessionExpiredListener(expired)

            const result = await service.pullAll()

            expect(result.ok).toBe(false)
            expect(result.credentialFailure).toBe(true)
            expect(expired).toHaveBeenCalledTimes(1)
            expect(result.lastError).toBe('登录已过期，请重新登录')
            // 不得被归成业务类文案（否则会被当作可退避的业务失败）
            expect(result.lastError).not.toBe('拉取失败：数据异常')
            expect(service.getLastSuccessfulPullAt()).toBeNull()
        })
    })

    describe('④ 90020 + 空表：正常空拉取仍成功', () => {
        it('90020 + 空表 ⇒ ok=true、mirrorPulledAt 前进、广播一次', async () => {
            const { requester, pulls } = pullRequester(() => ({
                data: { code: 90020, data: { data: {} } },
                serverTime: Date.now()
            }))
            const service = new SyncService(requester)
            const broadcast = createPullBroadcast()
            const received: unknown[] = []
            broadcast.subscribe((message) => received.push(message))

            const before = syncStatus.get()
            const result = await service.pullAll()

            expect(pulls()).toBe(1)
            expect(result.ok).toBe(true)
            expect(result.lastError).toBeNull()
            const after = syncStatus.get()
            expect(after.mirrorPulledAt).not.toBeNull()
            expect(Date.parse(after.mirrorPulledAt as string)).toBeGreaterThanOrEqual(
                Date.parse(before.mirrorPulledAt ?? '1970-01-01T00:00:00.000Z')
            )
            expect(after.mirrorTruncated).toBe(false)
            expect(service.getLastSuccessfulPullAt()).not.toBeNull()
            expect(received).toHaveLength(1)
            broadcast.dispose()
        })
    })

    it('90020 + 无表信袋（服务端未返回表）⇒ 仍判成功（成功码即授权，白名单而非「非 0 即失败」）', async () => {
        const { requester } = pullRequester(() => ({ data: { code: 90020, message: 'ok' } }))
        const service = new SyncService(requester)

        const result = await service.pullAll()

        expect(result.ok).toBe(true)
        expect(service.getLastSuccessfulPullAt()).not.toBeNull()
        expect(syncStatus.get().mirrorPulledAt).not.toBeNull()
    })

    describe('⑤ 兼容：有表信袋但缺 `code` 的老形状仍成功（不因加固而回归）', () => {
        it('无 `code` + 有表信袋 ⇒ 成功并推进新鲜度', async () => {
            const { requester } = pullRequester(() => ({
                data: { data: { data: {} } },
                serverTime: Date.now()
            }))
            const service = new SyncService(requester)

            const result = await service.pullAll()

            expect(result.ok).toBe(true)
            expect(syncStatus.get().mirrorPulledAt).not.toBeNull()
        })
    })
})