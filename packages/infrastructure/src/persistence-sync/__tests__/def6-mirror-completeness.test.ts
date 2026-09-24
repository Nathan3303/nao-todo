import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { syncStatus } from '../sync-status'
import { SyncService } from '../sync-service'

/**
 * DEF-6 / AC13 回归线 —— 本地镜像完整性（>200 行账号）
 *
 * **验收判据**（PRD §7 AC13）：`G` >200 行账号 ／ `W` **启动 1 次** ／ `T` 本地**含最新任务**（连续拉取）。
 *
 * **机制**（探针 P1 实测确证，见 `docs/reports/2026-09-23-DEF-PROBE-P1-offline-probes.md` §2）：
 * 修复前 `pullAllInner()` 单轮请求 `limit = PULL_LIMIT(200)`、排序 `updated_at ASC`（最旧优先）、
 * `.Unscoped()`（墓碑占窗口），**无续拉** ⇒ 620 行账号启动 1 次只落 200 行、**最新任务不在本地**。
 *
 * 本文件用「服务端 keyset 语义」的假 requester（含 `nextCursor/nextCursorId`）复刻该场景。
 * 覆盖 PM 指定四类：① 连续拉取 ② 终止条件 ③ 墓碑计入窗口 ④ 退避复用。
 *
 * **不改既有语义**：墓碑/窗口/limit 语义与修复前一致（本用例显式断言墓碑占窗口）。
 */

const PULL_LIMIT = 200
const FIXTURE_BASE_MS = Date.UTC(2026, 0, 1, 0, 0, 0)

/** 单行远端任务（字段与 `taskRes2TaskEntity` 契约一致） */
const remoteTask = (index: number, deletedAt: string | null = null): Record<string, unknown> => {
    const updatedAt = new Date(FIXTURE_BASE_MS + index * 1000).toISOString()
    return {
        id: `t-${String(index).padStart(4, '0')}`,
        createdAt: updatedAt,
        updatedAt,
        deletedAt,
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

const buildRemote = (total: number, tombstoneIndex = -1): Record<string, unknown>[] =>
    Array.from({ length: total }, (_, index) =>
        remoteTask(index, index === tombstoneIndex ? new Date(FIXTURE_BASE_MS).toISOString() : null)
    )

/** 前 `tombstoneCount` 行为墓碑（墓碑计入 limit 窗口，用于护栏 A 压力） */
const buildRemoteWithTombstones = (
    total: number,
    tombstoneCount: number
): Record<string, unknown>[] =>
    Array.from({ length: total }, (_, index) =>
        remoteTask(index, index < tombstoneCount ? new Date(FIXTURE_BASE_MS).toISOString() : null)
    )

/** 指定 id / updatedAt 的远端任务（护栏 B 的「永不取尽」流） */
const remoteTaskAt = (id: string, updatedAt: string): Record<string, unknown> => ({
    ...remoteTask(0),
    id,
    createdAt: updatedAt,
    updatedAt
})

const EMPTY_TABLE = { items: [], total: 0, nextCursor: '', nextCursorId: '' }

/** 服务端 `/sync/pull` 响应装配（三层 `data` 与生产契约一致） */
const pullResponse = (tasks: Record<string, unknown>) => ({
    data: {
        data: {
            data: {
                tasks,
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
})

/** 服务端 keyset 语义：`updated_at > c OR (updated_at = c AND id > cid)`，取前 limit 行 */
const keysetPage = (
    rows: Record<string, unknown>[],
    cursorAt: string,
    cursorId: string,
    limit: number
): Record<string, unknown>[] =>
    rows
        .filter((row) => {
            if (cursorAt === '') return true
            const at = row['updatedAt'] as string
            return (
                at > cursorAt ||
                (at === cursorAt && cursorId !== '' && (row['id'] as string) > cursorId)
            )
        })
        .slice(0, limit)

/** 记录每轮 `/sync/pull` 的 tasks 请求游标 */
type PullCursor = { updatedAt: string; cursorId: string }

/** 服务端替身：可注入拉取失败（模拟断网），成功时按 keyset 分页 */
const makeRequester = (
    rows: Record<string, unknown>[],
    isDown: () => boolean = () => false
): { requester: Requester; pullCursors: PullCursor[] } => {
    const pullCursors: PullCursor[] = []
    const requester = {
        post: async (url: string, body: unknown) => {
            if (url !== '/sync/pull') return { data: { results: [] }, serverTime: Date.now() }
            if (isDown()) return { code: 'ERR_NETWORK', data: { data: null } }
            const req =
                (body as { tasks?: { updatedAt?: string; cursorId?: string; limit?: number } })
                    .tasks ?? {}
            const cursorAt = String(req.updatedAt ?? '')
            const cursorId = String(req.cursorId ?? '')
            pullCursors.push({ updatedAt: cursorAt, cursorId })
            const limit = Number(req.limit ?? PULL_LIMIT)
            const page = keysetPage(rows, cursorAt, cursorId, limit)
            const last = page[page.length - 1]
            return pullResponse({
                items: page,
                total: page.length,
                nextCursor: (last?.['updatedAt'] as string) ?? '',
                nextCursorId: (last?.['id'] as string) ?? ''
            })
        },
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    } as unknown as Requester
    return { requester, pullCursors }
}

/** 清空全部表并建立会话 + 密钥（与 `sync.test.ts` 同口径） */
const setup = async (userId = 'test-user'): Promise<void> => {
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
    localSession.setCurrentUserId(userId)
    await cryptoService.setup(userId, 'test-password')
}

/** 本地已落任务的 updatedAt 最大值（时间上界） */
const localMaxUpdatedAt = async (): Promise<string | undefined> => {
    const rows = await localDatabase.tasks.toArray()
    return rows
        .map((row) => row.updatedAt)
        .filter(Boolean)
        .sort()
        .at(-1)
}

/**
 * 构造服务：测试环境落库极慢（fake-indexeddb + WebCrypto ~10ms/行）⇒
 * 默认放宽续拉时间预算以免误触生产默认 3s 上界；护栏 B 用例显式注入小上界。
 */
const newService = (
    requester: Requester,
    bounds: { pullMaxRounds?: number; pullTimeBudgetMs?: number } = {}
): SyncService => new SyncService(requester, { pullTimeBudgetMs: 60_000, ...bounds })

/**
 * T139（预防性，同族 DEF-28）隔离：本文件每用例都新建独立 `SyncService`，其条件退避定时器
 * （`scheduleBackfillTick` → `setTimeout(→ resumeBackfill)`）若在用例结束后仍存活，会经**全局单例**
 * `syncStatus.beginRun()` 清空在跑运行的 `runErrors`，污染后续用例（DEF-28 机制）。
 * 实测当前 12 例用例内均已清除（`afterEach` 存活定时器 = 0），此处为**预防性**兜底：
 * 用例结束即清掉本用例创建的定时器（不改生产代码、不放宽任何断言）。
 */
const timersCreatedInTest = new Set<ReturnType<typeof globalThis.setTimeout>>()
let realSetTimeout: typeof globalThis.setTimeout

beforeEach(() => {
    realSetTimeout = globalThis.setTimeout
    const trackingSetTimeout = (...args: Parameters<typeof globalThis.setTimeout>) => {
        const id = realSetTimeout(...args)
        timersCreatedInTest.add(id)
        return id
    }
    globalThis.setTimeout = trackingSetTimeout as typeof globalThis.setTimeout
})

afterEach(() => {
    for (const id of timersCreatedInTest) clearTimeout(id)
    timersCreatedInTest.clear()
    globalThis.setTimeout = realSetTimeout
})

describe(
    'DEF-6 / AC13：>200 行账号启动 1 次 ⇒ 本地含最新任务（连续拉取）',
    { timeout: 30_000 },
    () => {
        beforeEach(async () => {
            await setup()
        })

        const TOTAL = 250
        const ROWS = buildRemote(TOTAL)
        const NEWEST_ID = `t-${String(TOTAL - 1).padStart(4, '0')}`
        const NEWEST_UPDATED_AT = ROWS[TOTAL - 1]!['updatedAt'] as string

        it('pullAll() 单轮 ⇒ 本地落满全量（含最新任务）', async () => {
            const { requester, pullCursors } = makeRequester(ROWS)
            const service = newService(requester)

            await service.pullAll()

            expect(await localDatabase.tasks.count()).toBe(TOTAL)
            expect(await localDatabase.tasks.get(NEWEST_ID)).toBeDefined()
            // 续拉游标复用回拉窗口（Δ=1s）：请求游标 = 上一页末尾 − 1s，回拉时 cursorId 归零；
            // 250 行 ⇒ 两轮（首轮 0..199；次轮回拉后 199..249）
            expect(pullCursors).toHaveLength(2)
            expect(Date.parse(pullCursors[1]!.updatedAt)).toBe(
                Date.parse(ROWS[199]!['updatedAt'] as string) - 1000
            )
            expect(pullCursors[1]!.cursorId).toBe('')
        })

        it('时间上界：本地已含 fixture 最大 updatedAt（不截断在 200 边界）', async () => {
            const { requester } = makeRequester(ROWS)
            const service = newService(requester)

            await service.pullAll()

            expect(await localMaxUpdatedAt()).toBe(NEWEST_UPDATED_AT)
        })

        it('start() 单次运行（InitialSyncGate 路径）同样补齐至最新', async () => {
            const { requester } = makeRequester(ROWS)
            const service = newService(requester)

            await service.start()

            expect(await localDatabase.tasks.count()).toBe(TOTAL)
            expect(await localDatabase.tasks.get(NEWEST_ID)).toBeDefined()
        })
    }
)

describe('DEF-6 终止条件：满页续拉、取尽即止（无续拉风暴/无死循环）', { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await setup()
    })

    it('总数恰为 limit 整数倍 ⇒ 末轮空页终止（400 行 = 200+200+0）', async () => {
        const rows = buildRemote(400)
        const { requester, pullCursors } = makeRequester(rows)
        const service = newService(requester)

        await service.pullAll()

        expect(await localDatabase.tasks.count()).toBe(400)
        // 2 满页 + 1 空页（空页 nextCursor 为空 ⇒ 终止）
        expect(pullCursors).toHaveLength(3)
    })

    it('keyset 不前进（服务端重复返回同页）⇒ 立即终止，不死循环', async () => {
        const rows = buildRemote(PULL_LIMIT)
        const last = rows[rows.length - 1]!
        const pullCursors: PullCursor[] = []
        const requester = {
            post: async (url: string, body: unknown) => {
                if (url !== '/sync/pull') return { data: { results: [] }, serverTime: Date.now() }
                const req =
                    (body as { tasks?: { updatedAt?: string; cursorId?: string } }).tasks ?? {}
                pullCursors.push({
                    updatedAt: String(req.updatedAt ?? ''),
                    cursorId: String(req.cursorId ?? '')
                })
                // 恒返回同一满页（nextCursor/nextCursorId 恒等于该页末尾）
                return pullResponse({
                    items: rows,
                    total: rows.length,
                    nextCursor: last['updatedAt'] as string,
                    nextCursorId: last['id'] as string
                })
            },
            get: async () => ({ data: {} }),
            put: async () => ({ data: {} }),
            delete: async () => ({ data: {} })
        } as unknown as Requester
        const service = newService(requester)

        await service.pullAll()

        // 第二轮请求游标 == 服务端 nextCursor ⇒ 判定不前进并终止（仅 2 轮）
        expect(pullCursors).toHaveLength(2)
        expect(await localDatabase.tasks.count()).toBe(PULL_LIMIT)
    })

    it('服务端 Total 非剩余总数 ⇒ 不以 Total 判终止（AC13c：只用 items.length < limit）', async () => {
        const rows = buildRemote(250)
        const pullCursors: PullCursor[] = []
        const requester = {
            post: async (url: string, body: unknown) => {
                if (url !== '/sync/pull') return { data: { results: [] }, serverTime: Date.now() }
                const req =
                    (body as { tasks?: { updatedAt?: string; cursorId?: string; limit?: number } })
                        .tasks ?? {}
                const cursorAt = String(req.updatedAt ?? '')
                const cursorId = String(req.cursorId ?? '')
                pullCursors.push({ updatedAt: cursorAt, cursorId })
                const page = keysetPage(rows, cursorAt, cursorId, Number(req.limit ?? PULL_LIMIT))
                const last = page[page.length - 1]
                return pullResponse({
                    items: page,
                    // 误导性总量（非剩余总数）：若据 Total 判「还有更多」将永不终止
                    total: 999_999,
                    nextCursor: (last?.['updatedAt'] as string) ?? '',
                    nextCursorId: (last?.['id'] as string) ?? ''
                })
            },
            get: async () => ({ data: {} }),
            put: async () => ({ data: {} }),
            delete: async () => ({ data: {} })
        } as unknown as Requester
        const service = newService(requester)

        await service.pullAll()

        // 250 行 ⇒ 200 + 50；第二轮 50 < limit 即终止（不因 total=999999 继续）
        expect(pullCursors).toHaveLength(2)
        expect(await localDatabase.tasks.count()).toBe(250)
    })
})

describe('DEF-6 墓碑计入窗口：软删行占 limit 窗口且随续拉落库', { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await setup()
    })

    it('首页含墓碑 ⇒ 墓碑占窗口，续拉后最新任务仍在（语义未改）', async () => {
        const total = 250
        const tombstoneIndex = 199 // 第 200 行（首页末行）为墓碑
        const rows = buildRemote(total, tombstoneIndex)
        const tombstoneId = `t-${String(tombstoneIndex).padStart(4, '0')}`
        const newestId = `t-${String(total - 1).padStart(4, '0')}`
        const { requester, pullCursors } = makeRequester(rows)
        const service = newService(requester)

        await service.pullAll()

        // 墓碑占首页窗口（首页满 200 行含墓碑）⇒ 仍续拉并落满
        expect(pullCursors).toHaveLength(2)
        expect(await localDatabase.tasks.count()).toBe(total)
        // 墓碑落库且 deletedAt 保留
        const tombstone = await localDatabase.tasks.get(tombstoneId)
        expect(tombstone).toBeDefined()
        expect(tombstone?.deletedAt).toBe(new Date(FIXTURE_BASE_MS).toISOString())
        // 最新任务在本地
        expect(await localDatabase.tasks.get(newestId)).toBeDefined()
    })
})

describe('DEF-6 退避复用：拉取未取尽不跳过补拉（复用既有回传退避）', { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await setup()
    })

    it('无脏队列但拉取失败 ⇒ 仍安排回传定时补拉；resumeBackfill 先拉后推补齐', async () => {
        const rows = buildRemote(1)
        let down = true
        const { requester, pullCursors } = makeRequester(rows, () => down)
        const service = newService(requester)
        const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
        try {
            // 无脏队列（未创建任何本地任务）+ 拉取失败 ⇒ countDirty === 0 仍安排补拉 tick
            const failed = await service.start()
            expect(failed.ok).toBe(false)
            expect(await localDatabase.tasks.count()).toBe(0)
            const delays = setTimeoutSpy.mock.calls
                .map((call) => call[1])
                .filter((delay): delay is number => typeof delay === 'number')
            expect(delays.some((delay) => delay > 0 && delay <= 120000)).toBe(true)

            // 网络恢复：resumeBackfill 先拉（补全）后推，并清除定时器
            down = false
            const recovered = await service.resumeBackfill()
            expect(recovered.ok).toBe(true)
            expect(await localDatabase.tasks.count()).toBe(1)
            expect(pullCursors.length).toBeGreaterThanOrEqual(1)
            expect(clearTimeoutSpy).toHaveBeenCalled()
        } finally {
            setTimeoutSpy.mockRestore()
            clearTimeoutSpy.mockRestore()
        }
    })
})

describe(
    'DEF-6 护栏 A：墓碑密集仍在上界内拉完（每表 ≤10 轮 / 总预算 3s）',
    { timeout: 30_000 },
    () => {
        beforeEach(async () => {
            await setup()
        })

        it('250 活 + 250 墓碑 ⇒ 上界内拉完并推进 mirrorPulledAt', async () => {
            const total = 500
            const tombstoneCount = 250
            const rows = buildRemoteWithTombstones(total, tombstoneCount)
            const newestId = `t-${String(total - 1).padStart(4, '0')}`
            const { requester, pullCursors } = makeRequester(rows)
            const service = newService(requester)

            await service.pullAll()

            // 500 行 = 200+200+100（3 轮，远低于 10 轮上界）
            expect(pullCursors.length).toBeLessThanOrEqual(10)
            expect(await localDatabase.tasks.count()).toBe(total)
            expect(await localDatabase.tasks.get(newestId)).toBeDefined()
            const state = syncStatus.get()
            expect(state.mirrorTruncated).toBe(false)
            expect(state.mirrorPulledAt).toBeTruthy()
        })
    }
)

describe('DEF-6 护栏 B：上界截断不得谎报完整度（C-60 文案③）', { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await setup()
    })

    /** 服务端永不取尽（恒返回满页且 keyset 前进）⇒ 必触发上界 */
    const neverEndingRequester = (): { requester: Requester; pulls: () => number } => {
        let count = 0
        const requester = {
            post: async (url: string, body: unknown) => {
                if (url !== '/sync/pull') return { data: { results: [] }, serverTime: Date.now() }
                count += 1
                const req = (body as { tasks?: { updatedAt?: string } }).tasks ?? {}
                const base = Date.parse(String(req.updatedAt ?? '')) || FIXTURE_BASE_MS
                const items = Array.from({ length: PULL_LIMIT }, (_, index) =>
                    remoteTaskAt(
                        `r${count}-${index}`,
                        new Date(base + (index + 1) * 60000).toISOString()
                    )
                )
                const last = items[items.length - 1]!
                return pullResponse({
                    items,
                    total: items.length,
                    nextCursor: last['updatedAt'] as string,
                    nextCursorId: last['id'] as string
                })
            },
            get: async () => ({ data: {} }),
            put: async () => ({ data: {} }),
            delete: async () => ({ data: {} })
        } as unknown as Requester
        return { requester, pulls: () => count }
    }

    it('轮数上界截断 ⇒ mirrorPulledAt 不推进 + 触顶提示存在', async () => {
        const { requester, pulls } = neverEndingRequester()
        const before = syncStatus.get().mirrorPulledAt
        // 注入小轮数上界：确定性触发截断（生产默认 PULL_MAX_ROUNDS=10）
        const service = newService(requester, { pullMaxRounds: 2 })

        await service.pullAll()

        expect(pulls()).toBe(2)
        const state = syncStatus.get()
        // 截断不得谎报完整度：mirrorPulledAt 不推进 + 触顶提示存在
        expect(state.mirrorPulledAt).toBe(before)
        expect(state.mirrorTruncated).toBe(true)
    }, 30_000)

    it('时间预算截断 ⇒ mirrorPulledAt 不推进 + 触顶提示存在', async () => {
        const { requester, pulls } = neverEndingRequester()
        const before = syncStatus.get().mirrorPulledAt
        // 注入 0ms 预算：首轮前即触顶（覆盖时间上界分支）
        const service = newService(requester, { pullTimeBudgetMs: 0 })

        await service.pullAll()

        expect(pulls()).toBe(0)
        const state = syncStatus.get()
        expect(state.mirrorPulledAt).toBe(before)
        expect(state.mirrorTruncated).toBe(true)
    }, 30_000)
})

describe('DEF-6 / AC13b 门后补齐：截断后补拉路径最终拉满（同次会话）', { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await setup()
    })

    it('首启触顶不谎报 ⇒ pullIncomplete→resumeBackfill 最终拉满并推进 mirrorPulledAt', async () => {
        const total = 500
        const rows = buildRemote(total)
        const newestId = `t-${String(total - 1).padStart(4, '0')}`
        const { requester } = makeRequester(rows)
        // 注入小轮数上界（仅测试）：首启必被截断
        const service = newService(requester, { pullMaxRounds: 2 })
        const before = syncStatus.get().mirrorPulledAt

        await service.start()

        // 首启被上界截断：镜像未拉满 ⇒ 不得谎报完整度
        const truncatedCount = await localDatabase.tasks.count()
        expect(truncatedCount).toBeGreaterThan(0)
        expect(truncatedCount).toBeLessThan(total)
        expect(syncStatus.get().mirrorTruncated).toBe(true)
        expect(syncStatus.get().mirrorPulledAt).toBe(before)

        // 门后补拉路径：pullIncomplete ⇒ resumeBackfill（先拉后推）⇒ 最终拉满
        const recovered = await service.resumeBackfill()
        expect(recovered.ok).toBe(true)
        expect(await localDatabase.tasks.count()).toBe(total)
        expect(await localDatabase.tasks.get(newestId)).toBeDefined()
        const state = syncStatus.get()
        expect(state.mirrorTruncated).toBe(false)
        expect(state.mirrorPulledAt).toBeTruthy()
        expect(state.mirrorPulledAt).not.toBe(before)
    })
})