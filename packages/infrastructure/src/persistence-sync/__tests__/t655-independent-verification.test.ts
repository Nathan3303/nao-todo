import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { setJWTTokenProvider } from '../../persistence-go/utils'
import {
    AUTO_REFRESH_INTERVAL_MS,
    createAutoRefreshController,
    type AutoRefreshTimerHandle,
    type AutoRefreshTrigger
} from '../auto-refresh'
import { loadMirrorStatus, saveMirrorStatus } from '../mirror-status-store'
import { createPullBroadcast, type PullBroadcastChannelLike } from '../pull-broadcast'
import { syncStatus } from '../sync-status'
import { SyncService } from '../sync-service'

/**
 * T655 · 同步感知 A′（T654 + T657）**独立复验探针**
 *
 * @description 本文件由 QA（T655）独立编写，**不复用 RD 用例的断言角度**，用于在验收时
 *              自己拿数字（PM 明确要求「不许采信 RD 自述」）。只测「门控 / 判定」，不碰裁决语义：
 *              ① AC5b 合并门：5 次事件触发只 1 次网络；判据 = **上次成功**（失败既不推进、
 *                 也不把「上次成功」抹掉 —— 两条方向都断）；手动不过门。
 *              ② AC6 脏队列**只**门周期：周期 3 轮全跳过，`visible` / `online` 仍可拉（不饿死）；
 *                 清空后 ≤1 周期恢复。
 *              ③ AC7 单主 + 广播成对：非主标签**零网络**、`applyForeignPullComplete` 只刷视图；
 *                 锁释放后下一轮即接管（≤1 周期）。
 *              ④ AC2/AC4 新鲜度与停用：成功推进 `mirrorPulledAt`/`lastSyncAt`；凭证失效 ⇒ stop；
 *                 离线不建定时器。
 *              ⑤ T657 四态业务码 + **截断不推进**（`pending.size !== 0` ⇒ 不推进时间戳、不广播，
 *                 且随后的补拉**不被合并门挡下** —— DEF-6 回归线）。
 *
 * @see docs/prds/2026-11-05-sync-perception-polling.md（§五 R-1…R-10 / §七 AC1–AC11）
 * @see docs/reports/T655-qa-verification.md
 */

const USER_ID = 't655-user'
/** 固定「当前 token」：让 10041 代表**当前**凭证失效（否则被判为陈旧快照只记日志） */
const CURRENT_JWT = 'jwt-t655-current'
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

type PullBody = (body?: unknown) => unknown

/** 只统计 `/sync/pull` 与其它写请求的替身（默认空表 ⇒ 单轮取尽） */
const makeRequester = (
    pullBody: PullBody = () => ({ data: { code: 90020, data: { data: {} } } })
): { requester: Requester; pulls: () => number; otherWrites: () => number } => {
    let pulls = 0
    let otherWrites = 0
    const requester = {
        post: async (url: string, body?: unknown) => {
            if (url === '/sync/pull') {
                pulls += 1
                return pullBody(body)
            }
            otherWrites += 1
            return { data: { results: [] }, serverTime: Date.now() }
        },
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    } as unknown as Requester
    return { requester, pulls: () => pulls, otherWrites: () => otherWrites }
}

/** 手动时钟（只改 `Date.now`；不动 IndexedDB 与真实定时器） */
const createDateShift = (): { shift: (ms: number) => void; restore: () => void } => {
    const realNow = Date.now
    let offset = 0
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offset)
    return {
        shift: (ms) => {
            offset += ms
        },
        restore: () => spy.mockRestore()
    }
}

/** 假 `BroadcastChannel`（跨实例投递；用于断言「有没有广播 / 载荷形状」） */
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

/** 受控 `navigator.locks`：`setHeld(true)` = 主标签持锁，其余标签 `ifAvailable` 拿不到 */
const createFakeLocks = (): {
    locks: { request: unknown }
    setHeld: (held: boolean) => void
    attempts: () => number
} => {
    let held = false
    let attempts = 0
    return {
        locks: {
            request: async (
                _name: string,
                _options: unknown,
                callback: (lock: { name: string } | null) => Promise<void>
            ) => {
                attempts += 1
                if (held) {
                    await callback(null)
                    return
                }
                held = true
                try {
                    await callback({ name: 'held-by-me' })
                } finally {
                    held = false
                }
            }
        },
        setHeld: (next) => {
            held = next
        },
        attempts: () => attempts
    }
}

// ---------------------------------------------------------------------------
// AC5b 合并门
// ---------------------------------------------------------------------------
describe('T655 · AC5b 合并门（事件触发 10s 内只推不拉；判据 = 上次成功）', () => {
    beforeEach(async () => {
        vi.stubGlobal('navigator', {})
        await resetLocalState()
    })
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('1 分钟内 5 次事件触发（resumeBackfill）只产生 1 次网络拉取；跨过 10s 再放行', async () => {
        const { requester, pulls } = makeRequester()
        const service = new SyncService(requester)
        const clock = createDateShift()

        await service.pullAll()
        expect(pulls()).toBe(1)

        for (let i = 0; i < 5; i += 1) {
            expect((await service.resumeBackfill()).ok).toBe(true)
        }
        expect(pulls()).toBe(1)

        clock.shift(10_001)
        await service.resumeBackfill()
        expect(pulls()).toBe(2)
        clock.restore()
    })

    it('失败**不推进**合并门 ⇒ 失败后的下一次事件触发仍会拉（不得静默成「已是最新」）', async () => {
        let rateLimited = true
        const { requester, pulls } = makeRequester(() =>
            rateLimited
                ? { data: { code: 10051, message: '请求过于频繁' } }
                : { data: { code: 90020, data: { data: {} } } }
        )
        const service = new SyncService(requester)

        const failed = await service.pullAll()
        expect(failed.ok).toBe(false)
        expect(service.getLastSuccessfulPullAt()).toBeNull()
        expect(pulls()).toBe(1)

        // 判据是「上次成功」：从未成功 ⇒ 事件触发必须照拉
        rateLimited = false
        const next = await service.resumeBackfill()
        expect(next.ok).toBe(true)
        expect(pulls()).toBe(2)
        expect(service.getLastSuccessfulPullAt()).not.toBeNull()
    })

    it('失败**不刷新**「上次成功」时间戳：成功后 9s 内（即便中间失败过）事件触发仍被合并', async () => {
        let failing = false
        const { requester, pulls } = makeRequester(() =>
            failing
                ? { data: { code: 90022, message: '任务增量拉取失败' } }
                : { data: { code: 90020, data: { data: {} } } }
        )
        const service = new SyncService(requester)
        const clock = createDateShift()

        await service.pullAll() // 成功 @ t0
        expect(pulls()).toBe(1)

        clock.shift(5_000)
        failing = true
        await service.pullAll() // 周期拉取（不过门）失败 @ t0+5s
        expect(pulls()).toBe(2)

        clock.shift(2_000)
        await service.resumeBackfill() // t0+7s：距上次**成功** 7s < 10s ⇒ 只推不拉
        expect(pulls()).toBe(2)

        clock.shift(3_500)
        await service.resumeBackfill() // t0+10.5s ⇒ 放行
        expect(pulls()).toBe(3)
        clock.restore()
    })

    it('手动「立即同步」不受合并门限制（紧接成功拉取也照拉）', async () => {
        const { requester, pulls } = makeRequester()
        const service = new SyncService(requester)

        await service.pullAll()
        expect(pulls()).toBe(1)
        await service.manualSync()
        expect(pulls()).toBe(2)
    })
})

// ---------------------------------------------------------------------------
// AC6 脏队列只门周期
// ---------------------------------------------------------------------------
type Scheduled = { fn: () => void; delayMs: number; dueAt: number }

const createClock = () => {
    let now = 0
    let seq = 0
    const tasks = new Map<number, Scheduled>()
    const delays: number[] = []
    return {
        delays,
        get pending(): number {
            return tasks.size
        },
        setTimeout: (fn: () => void, delayMs: number): AutoRefreshTimerHandle => {
            seq += 1
            delays.push(delayMs)
            tasks.set(seq, { fn, delayMs, dueAt: now + delayMs })
            return seq
        },
        clearTimeout: (handle: AutoRefreshTimerHandle): void => {
            tasks.delete(handle as number)
        },
        advance: async (ms: number): Promise<void> => {
            now += ms
            for (let guard = 0; guard < 100; guard += 1) {
                const next = [...tasks.entries()]
                    .filter(([, task]) => task.dueAt <= now)
                    .sort((a, b) => a[1].dueAt - b[1].dueAt)[0]
                if (!next) {
                    await new Promise((resolve) => setTimeout(resolve, 0))
                    const stillDue = [...tasks.values()].some((task) => task.dueAt <= now)
                    if (!stillDue) return
                    continue
                }
                tasks.delete(next[0])
                next[1].fn()
                await new Promise((resolve) => setTimeout(resolve, 0))
            }
            throw new Error('advance guard 触发：定时器调度疑似死循环')
        }
    }
}

/** 让异步链（`await pull()` 等微任务）走完 */
const flushMicrotasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('T655 · AC6 脏队列只门周期（事件触发不被饿死）', () => {
    const harness = () => {
        let pending = false
        let visible = true
        let offline = false
        const pulls: AutoRefreshTrigger[] = []
        let dirtyReads = 0
        const clock = createClock()
        const controller = createAutoRefreshController({
            pull: async (trigger) => {
                pulls.push(trigger)
                return { ok: true }
            },
            hasPendingLocalWrites: async () => {
                dirtyReads += 1
                return pending
            },
            isVisible: () => visible,
            isOffline: () => offline,
            setTimeout: clock.setTimeout,
            clearTimeout: clock.clearTimeout
        })
        return {
            controller,
            clock,
            pulls,
            dirtyReads: () => dirtyReads,
            setPending: (next: boolean) => {
                pending = next
            },
            setVisible: (next: boolean) => {
                visible = next
            },
            setOffline: (next: boolean) => {
                offline = next
            }
        }
    }

    it('脏队列非空 ⇒ 连续 3 个周期（90s）零拉取；清空后 ≤1 周期恢复', async () => {
        const h = harness()
        h.setPending(true)
        h.controller.start()

        await h.clock.advance(AUTO_REFRESH_INTERVAL_MS)
        await h.clock.advance(AUTO_REFRESH_INTERVAL_MS)
        await h.clock.advance(AUTO_REFRESH_INTERVAL_MS)
        expect(h.pulls).toEqual([])
        expect(h.dirtyReads()).toBe(3) // 每周期都重新读队列（不是缓存）

        h.setPending(false)
        await h.clock.advance(AUTO_REFRESH_INTERVAL_MS)
        expect(h.pulls).toEqual(['periodic'])
        h.controller.dispose()
    })

    it('脏队列期间 `visible` / `online` 事件仍可拉（R-4：不受脏队列门控限制）', async () => {
        const h = harness()
        h.setPending(true)
        h.controller.start()
        await h.clock.advance(AUTO_REFRESH_INTERVAL_MS)
        expect(h.pulls).toEqual([])

        h.controller.setVisible(false)
        h.controller.setVisible(true)
        await flushMicrotasks()
        expect(h.pulls).toEqual(['visible'])

        h.controller.setOffline(true)
        h.controller.setOffline(false)
        await flushMicrotasks()
        expect(h.pulls).toEqual(['visible', 'online'])
        h.controller.dispose()
    })
})

// ---------------------------------------------------------------------------
// AC7 单主 + 广播成对
// ---------------------------------------------------------------------------
describe('T655 · AC7 单主 + 广播成对（非主标签零网络，只刷视图）', () => {
    beforeEach(async () => {
        FakeBroadcastChannel.instances = []
        vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
        await resetLocalState()
    })
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        FakeBroadcastChannel.instances = []
    })

    it('未取到锁 ⇒ 零网络；锁释放后下一轮（≤1 周期）即接管并拉取', async () => {
        const lock = createFakeLocks()
        vi.stubGlobal('navigator', { locks: lock.locks })
        const { requester, pulls } = makeRequester()
        const follower = new SyncService(requester)

        lock.setHeld(true) // 主标签持锁
        const skipped = await follower.pullAll()
        expect(pulls()).toBe(0) // 非主标签：零网络
        expect(skipped.pullExecuted).toBe(false)
        expect(lock.attempts()).toBe(1)

        lock.setHeld(false) // 主标签关闭 / 释放
        await follower.pullAll()
        expect(pulls()).toBe(1)
        expect(lock.attempts()).toBe(2)
    })

    it('主标签拉取成功 ⇒ 广播一条**仅信号**的通知（无业务数据/版本号）', async () => {
        vi.stubGlobal('navigator', {})
        const { requester, pulls } = makeRequester()
        const service = new SyncService(requester)
        const subscriber = createPullBroadcast()
        const received: Array<Record<string, unknown>> = []
        subscriber.subscribe((message) => received.push({ ...message }))

        await service.pullAll()

        expect(pulls()).toBe(1)
        expect(received).toHaveLength(1)
        expect(received[0]).toEqual({
            type: 'pull-complete',
            userId: USER_ID,
            at: expect.any(Number)
        })
        // 载荷键集合必须恰好是这三个（多一个键 = 第二条裁决路径的风险面）
        expect(Object.keys(received[0]!).sort()).toEqual(['at', 'type', 'userId'])
        subscriber.dispose()
    })

    it('非主标签收到广播 ⇒ 只刷新视图（零网络）+ 合并门时间收敛到主标签', async () => {
        vi.stubGlobal('navigator', {})
        const { requester, pulls, otherWrites } = makeRequester()
        const follower = new SyncService(requester)
        const refreshed = vi.fn()
        follower.setDataChangedListener(refreshed)

        follower.applyForeignPullComplete(1_700_000_000_000)

        expect(refreshed).toHaveBeenCalledTimes(1)
        expect(pulls()).toBe(0)
        expect(otherWrites()).toBe(0)
        expect(follower.getLastSuccessfulPullAt()).toBe(1_700_000_000_000)
    })
})

// ---------------------------------------------------------------------------
// AC2 / AC4 新鲜度与停用
// ---------------------------------------------------------------------------
describe('T655 · AC2 新鲜度推进 / AC4 停用（离线不建定时器、凭证失效停周期）', () => {
    beforeEach(async () => {
        vi.stubGlobal('navigator', {})
        await resetLocalState()
    })
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('周期拉取成功 ⇒ mirrorPulledAt 推进、lastSyncAt 不为空、syncing 回到 false（无抖动）', async () => {
        const { requester } = makeRequester()
        const service = new SyncService(requester)

        const before = syncStatus.get()
        const result = await service.pullAll()
        const after = syncStatus.get()

        expect(result.ok).toBe(true)
        expect(after.mirrorPulledAt).not.toBeNull()
        expect(after.mirrorPulledAt).not.toBe(before.mirrorPulledAt)
        expect(after.lastSyncAt).not.toBeNull()
        expect(after.syncing).toBe(false)
        expect(after.mirrorTruncated).toBe(false)
    })

    it('离线 ⇒ 不建定时器、零拉取；恢复联网 ⇒ 立即拉一次', async () => {
        const pulls: AutoRefreshTrigger[] = []
        const clock = createClock()
        let offline = true
        const controller = createAutoRefreshController({
            pull: async (trigger) => {
                pulls.push(trigger)
                return { ok: true }
            },
            hasPendingLocalWrites: async () => false,
            isVisible: () => true,
            isOffline: () => offline,
            setTimeout: clock.setTimeout,
            clearTimeout: clock.clearTimeout
        })

        controller.start()
        expect(clock.pending).toBe(0)
        await clock.advance(AUTO_REFRESH_INTERVAL_MS * 5)
        expect(pulls).toEqual([])

        offline = false
        controller.setOffline(false)
        expect(pulls).toEqual(['online'])
        controller.dispose()
    })

    it('凭证失效（stop）⇒ 停用且不再安排定时器（不周期重试）', async () => {
        const clock = createClock()
        const controller = createAutoRefreshController({
            pull: async () => ({ ok: false, stop: true }),
            hasPendingLocalWrites: async () => false,
            isVisible: () => true,
            isOffline: () => false,
            setTimeout: clock.setTimeout,
            clearTimeout: clock.clearTimeout
        })

        controller.start()
        await clock.advance(AUTO_REFRESH_INTERVAL_MS)

        expect(controller.isDisposed()).toBe(true)
        expect(clock.pending).toBe(0)
        await clock.advance(AUTO_REFRESH_INTERVAL_MS * 3)
        expect(clock.pending).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// T657 四态业务码 + 截断不推进
// ---------------------------------------------------------------------------
const resetCursors = async (): Promise<void> => {
    await localDatabase.syncCursor.clear()
}

const newService = (
    requester: Requester,
    options: { pullMaxRounds?: number; pullTimeBudgetMs?: number } = {}
): SyncService => new SyncService(requester, { pullTimeBudgetMs: 60_000, ...options })

/** 单行远端任务（字段与 `taskRes2TaskEntity` 契约一致；仅截断用例需要） */
const remoteTask = (index: number): Record<string, unknown> => {
    const updatedAt = new Date(Date.UTC(2026, 0, 1) + index * 1000).toISOString()
    return {
        id: `t6-${String(index).padStart(4, '0')}`,
        createdAt: updatedAt,
        updatedAt,
        deletedAt: null,
        parentTaskId: null,
        name: `task-${index}`,
        description: '',
        state: 'todo',
        priority: 'medium',
        startAt: null,
        endAt: null,
        projectId: null,
        tags: [],
        archivedAt: null,
        starMarkAt: null,
        givenUpAt: null,
        remindAt: null,
        remindRepeat: 'none',
        remindTime: null,
        remindWeekdays: [],
        checkItemCount: 0,
        commentCount: 0,
        subtaskCount: 0,
        sortId: 0
    }
}

const EMPTY_TABLE = { items: [], total: 0, nextCursor: '', nextCursorId: '' }

describe('T655 · T657 四态业务码（服务端码已独立核对：90020 成功 / 90022 拉取失败 / 10051 限流 / 10041 凭证）', () => {
    beforeEach(async () => {
        FakeBroadcastChannel.instances = []
        vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
        vi.stubGlobal('navigator', {})
        await resetLocalState()
        await resetCursors()
    })
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        FakeBroadcastChannel.instances = []
    })

    const expectBusinessFailure = async (
        body: () => unknown,
        expectedError: string
    ): Promise<void> => {
        const { requester, pulls } = makeRequester(body)
        const service = newService(requester)
        const subscriber = createPullBroadcast()
        const received: unknown[] = []
        subscriber.subscribe((message) => received.push(message))

        const mirrorBefore = syncStatus.get().mirrorPulledAt
        const cursorsBefore = await localDatabase.syncCursor.toArray()

        const result = await service.pullAll()

        expect(pulls()).toBe(1)
        expect(result.ok).toBe(false)
        expect(result.lastError).toBe(expectedError)
        expect(result.credentialFailure).toBe(false)
        expect(syncStatus.get().mirrorPulledAt).toBe(mirrorBefore) // 不推进新鲜度
        expect(syncStatus.get().syncing).toBe(false)
        expect(result.lastError).not.toBeNull() // 界面得到**错误**而非「已是最新」
        expect(service.getLastSuccessfulPullAt()).toBeNull() // 不推进合并门
        expect(received).toEqual([]) // 不广播
        expect(await localDatabase.syncCursor.toArray()).toEqual(cursorsBefore) // 游标不前进
        subscriber.dispose()
    }

    it('① 10051 + 无 data ⇒ 业务失败（限流文案）+ 不推进 + 不广播', async () => {
        await expectBusinessFailure(
            () => ({ data: { code: 10051, message: '请求过于频繁' } }),
            '拉取失败：请求过于频繁，请稍后再试'
        )
    })

    it('② 90022 + 无 data ⇒ 业务失败（数据异常文案）', async () => {
        await expectBusinessFailure(
            () => ({ data: { code: 90022, message: '任务增量拉取失败' } }),
            '拉取失败：数据异常'
        )
    })

    it('③ 10041 ⇒ 既有鉴权路径（credentialFailure，不混进业务退避）', async () => {
        const { requester } = makeRequester(() => ({ data: { code: 10041, message: '凭证失效' } }))
        const service = newService(requester)
        const expired = vi.fn()
        service.setSessionExpiredListener(expired)

        const result = await service.pullAll()

        expect(result.ok).toBe(false)
        expect(result.credentialFailure).toBe(true)
        expect(expired).toHaveBeenCalledTimes(1)
        expect(result.lastError).toBe('登录已过期，请重新登录')
        expect(service.getLastSuccessfulPullAt()).toBeNull()
    })

    it('④ 90020 + 空表 ⇒ 成功（推进 + 广播一次）', async () => {
        const { requester } = makeRequester()
        const service = newService(requester)
        const subscriber = createPullBroadcast()
        const received: unknown[] = []
        subscriber.subscribe((message) => received.push(message))

        const result = await service.pullAll()

        expect(result.ok).toBe(true)
        expect(result.lastError).toBeNull()
        expect(syncStatus.get().mirrorPulledAt).not.toBeNull()
        expect(service.getLastSuccessfulPullAt()).not.toBeNull()
        expect(received).toHaveLength(1)
        subscriber.dispose()
    })

    it('④b 90020 + **无表信袋** ⇒ 仍判成功（白名单 `[90020]` 而非「非 0 即成功」）', async () => {
        const { requester } = makeRequester(() => ({
            data: { code: 90020, message: '批量拉取成功' }
        }))
        const service = newService(requester)

        const result = await service.pullAll()

        expect(result.ok).toBe(true)
        expect(service.getLastSuccessfulPullAt()).not.toBeNull()
        expect(syncStatus.get().mirrorPulledAt).not.toBeNull()
    })

    it('⑤ 截断（pending 未清空）⇒ 不推进 mirrorPulledAt / 不推进合并门 / 不广播；随后补拉不被合并门挡', async () => {
        const rows = Array.from({ length: 250 }, (_, index) => remoteTask(index))
        const { requester, pulls } = makeRequester((body) => {
            // 服务端 keyset 语义：`updated_at > c OR (= c AND id > cid)`，取前 limit 行
            const cursor =
                (body as { tasks?: { updatedAt?: string; cursorId?: string; limit?: number } })
                    .tasks ?? {}
            const cursorAt = String(cursor.updatedAt ?? '')
            const cursorId = String(cursor.cursorId ?? '')
            const limit = Number(cursor.limit ?? 200)
            const bodyRows = rows
                .filter((row) => {
                    if (cursorAt === '') return true
                    const at = row['updatedAt'] as string
                    return (
                        at > cursorAt ||
                        (at === cursorAt && cursorId !== '' && (row['id'] as string) > cursorId)
                    )
                })
                .slice(0, limit)
            const last = bodyRows.at(-1) as { updatedAt?: string; id?: string } | undefined
            return {
                data: {
                    code: 90020,
                    data: {
                        data: {
                            tasks: {
                                items: bodyRows,
                                total: bodyRows.length,
                                nextCursor: String(last?.['updatedAt'] ?? ''),
                                nextCursorId: String(last?.['id'] ?? '')
                            },
                            taskCheckItems: EMPTY_TABLE,
                            taskComments: EMPTY_TABLE,
                            projects: EMPTY_TABLE,
                            tags: EMPTY_TABLE,
                            pomodoros: EMPTY_TABLE,
                            pomodoroRecords: EMPTY_TABLE
                        }
                    }
                },
                serverTime: Date.now()
            }
        })
        // 只允许 1 轮 ⇒ 必然截断（挂起未取尽的表）
        const service = newService(requester, { pullMaxRounds: 1 })
        const subscriber = createPullBroadcast()
        const received: unknown[] = []
        subscriber.subscribe((message) => received.push(message))
        const refreshed = vi.fn()
        service.setDataChangedListener(refreshed)

        const mirrorBefore = syncStatus.get().mirrorPulledAt
        const first = await service.pullAll()

        expect(pulls()).toBe(1)
        expect(first.ok).toBe(true)
        expect(syncStatus.get().mirrorTruncated).toBe(true)
        expect(syncStatus.get().mirrorPulledAt).toBe(mirrorBefore) // 截断不推进
        expect(service.getLastSuccessfulPullAt()).toBeNull() // 截断不推进合并门
        expect(received).toEqual([]) // 截断不广播
        // 拉取**确实把远端数据落进本地镜像**（⇒ 界面有可刷新的新数据；AC1 的前提）
        expect(await localDatabase.tasks.count()).toBe(200)
        expect(refreshed).toHaveBeenCalled()

        // 补拉：判据是「上次成功」= null ⇒ 事件触发必须照拉（DEF-6 补拉不被合并门挡）
        const second = await service.resumeBackfill()
        expect(pulls()).toBe(2)
        expect(second.ok).toBe(true)
        expect(syncStatus.get().mirrorTruncated).toBe(false)
        expect(syncStatus.get().mirrorPulledAt).not.toBeNull()
        expect(service.getLastSuccessfulPullAt()).not.toBeNull()
        expect(received).toHaveLength(1)
        expect(await localDatabase.tasks.count()).toBe(250) // 补拉补齐，无重复/无覆盖丢失
        subscriber.dispose()
    }, 60_000)
})

// ---------------------------------------------------------------------------
// T659 追加复验（DEF-142）—— 广播命中的新鲜度收敛
// ---------------------------------------------------------------------------
describe('T655b · T659 追加复验（DEF-142：广播命中 ⇒ 新鲜度收敛，截断态不被清）', () => {
    const OLD = '2020-01-01T00:00:00.000Z'

    beforeEach(async () => {
        FakeBroadcastChannel.instances = []
        vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
        vi.stubGlobal('navigator', {})
        await resetLocalState()
        syncStatus.restoreMirrorStatus({ mirrorPulledAt: null, mirrorTruncated: false })
    })
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        FakeBroadcastChannel.instances = []
    })

    it('① 广播**发出时**：内存新鲜度已前进 且 meta 已落盘（先落盘再广播的顺序证明）', async () => {
        const { requester } = makeRequester()
        const master = new SyncService(requester)
        const subscriber = createPullBroadcast()
        const observed: Array<{ at: number; memAt: string | null; persistedAt: string | null }> = []
        subscriber.subscribe((message) => {
            const slot = {
                at: message.at,
                memAt: syncStatus.get().mirrorPulledAt,
                persistedAt: null as string | null
            }
            observed.push(slot)
            // 广播**送达瞬间**就去读 meta：若实现「先广播后落盘」，这里读到的是旧值
            void loadMirrorStatus(USER_ID).then((persisted) => {
                slot.persistedAt = persisted?.mirrorPulledAt ?? null
            })
        })

        const result = await master.pullAll()
        await flushMicrotasks()

        expect(result.ok).toBe(true)
        expect(observed).toHaveLength(1)
        const seen = observed[0]!
        // 内存已前进
        expect(seen.memAt).not.toBeNull()
        expect(Date.parse(seen.memAt as string)).toBeGreaterThan(Date.parse(OLD))
        // meta 已落盘（顺序证明：post 必须在 persist 之后）
        expect(seen.persistedAt).not.toBeNull()
        expect(Date.parse(seen.persistedAt as string)).toBe(Date.parse(seen.memAt as string))
        subscriber.dispose()
    })

    it('② 非主标签（内存 truncated=true / 落盘 false）收广播 ⇒ 收敛为**完整态**（只能来自持久化事实）+ 零网络', async () => {
        await saveMirrorStatus(USER_ID, {
            mirrorPulledAt: new Date(Date.now() - 60_000).toISOString(),
            mirrorTruncated: false
        })
        syncStatus.restoreMirrorStatus({ mirrorPulledAt: OLD, mirrorTruncated: true })

        const { requester, pulls, otherWrites } = makeRequester()
        const follower = new SyncService(requester)
        const refreshed = vi.fn()
        follower.setDataChangedListener(refreshed)
        const broadcastAt = Date.now()

        await follower.applyForeignPullComplete(broadcastAt)

        const after = syncStatus.get()
        expect(Date.parse(after.mirrorPulledAt as string)).toBeGreaterThanOrEqual(broadcastAt)
        expect(after.mirrorTruncated).toBe(false) // 持久化事实 = 完整 ⇒ 收敛为完整
        expect(pulls()).toBe(0)
        expect(otherWrites()).toBe(0)
        expect(refreshed).toHaveBeenCalledTimes(1)
        expect(follower.getLastSuccessfulPullAt()).toBe(broadcastAt)
    })

    it('③ 截断态（meta truncated=true）+ 广播 ⇒ 时间前进但 **truncated 保持 true**（不假绿）', async () => {
        await saveMirrorStatus(USER_ID, { mirrorPulledAt: OLD, mirrorTruncated: true })
        syncStatus.restoreMirrorStatus({ mirrorPulledAt: OLD, mirrorTruncated: true })

        const { requester, pulls, otherWrites } = makeRequester()
        const follower = new SyncService(requester)
        const broadcastAt = Date.now()

        await follower.applyForeignPullComplete(broadcastAt)

        const after = syncStatus.get()
        expect(Date.parse(after.mirrorPulledAt as string)).toBeGreaterThanOrEqual(broadcastAt)
        expect(after.mirrorTruncated).toBe(true)
        expect(pulls()).toBe(0)
        expect(otherWrites()).toBe(0)
    })

    it('④ 主标签路径不回归：广播仍 1 条 / 载荷仍恰好 3 键 / 新鲜度推进 / 落盘与内存一致', async () => {
        const { requester } = makeRequester()
        const master = new SyncService(requester)
        const subscriber = createPullBroadcast()
        const received: Array<Record<string, unknown>> = []
        subscriber.subscribe((message) => received.push({ ...message }))

        syncStatus.restoreMirrorStatus({ mirrorPulledAt: OLD, mirrorTruncated: true })
        const result = await master.pullAll()

        expect(result.ok).toBe(true)
        expect(received).toHaveLength(1)
        expect(Object.keys(received[0]!).sort()).toEqual(['at', 'type', 'userId'])
        const mem = syncStatus.get()
        expect(Date.parse(mem.mirrorPulledAt as string)).toBeGreaterThan(Date.parse(OLD))
        expect(mem.mirrorTruncated).toBe(false)
        const persisted = await loadMirrorStatus(USER_ID)
        expect(persisted?.mirrorPulledAt).toBe(mem.mirrorPulledAt)
        expect(persisted?.mirrorTruncated).toBe(false)
        subscriber.dispose()
    })

    it('⑤ 无会话时收敛不抛错、不改状态（登出后迟到广播的兜底）', async () => {
        vi.stubGlobal('navigator', {})
        const { requester } = makeRequester()
        const service = new SyncService(requester)
        syncStatus.restoreMirrorStatus({ mirrorPulledAt: OLD, mirrorTruncated: true })

        localSession.setCurrentUserId('')
        await expect(service.applyForeignPullComplete(Date.now())).resolves.toBeUndefined()

        expect(syncStatus.get().mirrorPulledAt).toBe(OLD)
        expect(syncStatus.get().mirrorTruncated).toBe(true)
        localSession.setCurrentUserId(USER_ID)
    })
})