import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { AUTO_REFRESH_INTERVAL_MS } from '../auto-refresh'
import { createPullBroadcast, type PullBroadcastChannelLike } from '../pull-broadcast'
import { SyncService } from '../sync-service'

/**
 * T654 · AC5b（合并门）+ AC7（单主 / 广播成对）
 *
 * @description 两件事都落在 `SyncService` 侧，因此用**真**服务 + 假 `BroadcastChannel` / 假
 *              `navigator.locks` 断言，不碰门控层：
 *              ① 事件触发（`resumeBackfill`）距上次**成功**拉取 <10s ⇒ **不发第二次网络**；
 *                 手动 `manualSync` 永不过门（AC5b）；
 *              ② 拉取成功 ⇒ 广播一条**无数据载荷**的通知；非主标签收到后**只刷新视图**、不发网络
 *                 （修既有缺陷：`ifAvailable` 未取锁即跳过、无补偿 ⇒ 非主标签永久陈旧）；
 *              ③ 未取到锁 ⇒ 本轮零请求（既有单主语义不变）；主标签退出/释放锁后，幸存标签的
 *                 下一次周期（30s）即可取得锁并继续刷新。
 * @see docs/prds/2026-11-05-sync-perception-polling.md（R-6 / R-9 / AC5b / AC7）
 * @see docs/reports/T653-realtime-feasibility.md（§6.4 单主锁的坑）
 */

const USER_ID = 'test-user'

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

/** 只统计 `/sync/pull` 的替身 requester（空数据 ⇒ 单轮取尽） */
const pullRequester = (): { requester: Requester; pulls: () => number } => {
    let pulls = 0
    const requester = {
        post: async (url: string) => {
            if (url === '/sync/pull') {
                pulls += 1
                return { data: { data: { data: {} } }, serverTime: Date.now() }
            }
            return { data: { results: [] }, serverTime: Date.now() }
        },
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    } as unknown as Requester
    return { requester, pulls: () => pulls }
}

/** 手动时钟（只改 `Date.now`，不影响 IndexedDB） */
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

describe('T654 · AC5b 合并门（事件触发 10s 内只推不拉，手动不过门）', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('一分钟内 alt-tab 五个来回（事件触发 5 次）只产生 1 次网络拉取；>10s 后再放行', async () => {
        const { requester, pulls } = pullRequester()
        const service = new SyncService(requester)
        const clock = createDateShift()

        await service.pullAll()
        expect(pulls()).toBe(1)

        // 五个来回：全部落在合并门窗口内 ⇒ 只推不拉
        for (let i = 0; i < 5; i += 1) {
            const result = await service.resumeBackfill()
            expect(result.ok).toBe(true)
        }
        expect(pulls()).toBe(1)

        // 越过 10s 合并门 ⇒ 恢复拉取
        clock.shift(10_001)
        await service.resumeBackfill()
        expect(pulls()).toBe(2)
        clock.restore()
    })

    it('手动「立即同步」不受合并门限制（紧接上一次成功拉取也照拉）', async () => {
        const { requester, pulls } = pullRequester()
        const service = new SyncService(requester)

        await service.pullAll()
        expect(pulls()).toBe(1)
        await service.manualSync()
        expect(pulls()).toBe(2)
    })

    it('上一次拉取**失败**不推进合并门（失败后的事件触发仍会拉）', async () => {
        let fail = true
        let pulls = 0
        const requester = {
            post: async (url: string) => {
                if (url !== '/sync/pull') return { data: { results: [] }, serverTime: Date.now() }
                pulls += 1
                if (fail) throw { response: { status: 500 } }
                return { data: { data: { data: {} } }, serverTime: Date.now() }
            },
            get: async () => ({ data: {} }),
            put: async () => ({ data: {} }),
            delete: async () => ({ data: {} })
        } as unknown as Requester
        const service = new SyncService(requester)

        await service.pullAll()
        expect(pulls).toBe(1)
        expect(service.getLastSuccessfulPullAt()).toBeNull()

        fail = false
        await service.resumeBackfill()
        expect(pulls).toBe(2)
    })
})

/** 假 `BroadcastChannel`（同源多标签：投递给**其它**实例，同步派发便于断言） */
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

describe('T654 · AC7 单主 + 广播成对', () => {
    beforeEach(async () => {
        FakeBroadcastChannel.instances = []
        vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
        vi.stubGlobal('navigator', {})
        await resetLocalState()
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        FakeBroadcastChannel.instances = []
    })

    it('拉取成功 ⇒ 广播一条无数据载荷的「已拉取」通知（userId + at）', async () => {
        const { requester } = pullRequester()
        const service = new SyncService(requester)
        // 监听侧：另开一个频道（模拟同 origin 的另一标签）
        const listener = createPullBroadcast()
        const received: unknown[] = []
        listener.subscribe((message) => received.push(message))

        await service.pullAll()

        expect(received).toHaveLength(1)
        const message = received[0] as { type: string; userId: string; at: number }
        expect(message.type).toBe('pull-complete')
        expect(message.userId).toBe(USER_ID)
        expect(typeof message.at).toBe('number')
        // 硬约束：广播**不得**携带业务数据 / 版本号（防第二条裁决路径）
        expect(Object.keys(message).sort()).toEqual(['at', 'type', 'userId'])
        listener.dispose()
    })

    it('非主标签收到广播 ⇒ 只刷新本地视图（零网络请求）', async () => {
        const { requester, pulls } = pullRequester()
        const service = new SyncService(requester)
        const refreshed = vi.fn()
        service.setDataChangedListener(refreshed)

        service.applyForeignPullComplete(1_000)

        expect(refreshed).toHaveBeenCalledTimes(1)
        expect(pulls()).toBe(0)
        // 合并门时间收敛到主标签的完成时间（避免多标签重复拉）
        expect(service.getLastSuccessfulPullAt()).toBe(1_000)
    })

    /** 命名锁管理器（`ifAvailable` 语义：已持有 ⇒ 回调 null） */
    const createLockManager = (): {
        request: (
            name: string,
            options: unknown,
            callback: (lock: unknown) => Promise<void>
        ) => Promise<void>
        held: Set<string>
    } => {
        const held = new Set<string>()
        return {
            held,
            request: async (name, _options, callback) => {
                if (held.has(name)) {
                    await callback(null)
                    return
                }
                held.add(name)
                try {
                    await callback({ name })
                } finally {
                    held.delete(name)
                }
            }
        }
    }

    it('主标签持锁 ⇒ 非主标签本轮零请求（既有单主语义不变）；释放后幸存标签可继续刷新', async () => {
        const locks = createLockManager()
        vi.stubGlobal('navigator', { locks: { request: locks.request } })

        const survivor = pullRequester()
        const service = new SyncService(survivor.requester)

        // 模拟「主标签正在拉取」：锁被占
        locks.held.add(`nao-todo:pull:${USER_ID}`)
        await service.pullAll()
        expect(survivor.pulls()).toBe(0)

        // 主标签关闭 ⇒ 锁释放；幸存标签的下一次周期（30s）即可接管
        locks.held.clear()
        expect(AUTO_REFRESH_INTERVAL_MS).toBeLessThanOrEqual(30_000)
        await service.pullAll()
        expect(survivor.pulls()).toBe(1)
    })
})