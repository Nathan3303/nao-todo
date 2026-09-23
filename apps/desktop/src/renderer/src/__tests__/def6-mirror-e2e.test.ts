// @vitest-environment jsdom
import './setup-fake-indexeddb'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { NueButton, NueDiv, NueMain, NueText } from 'nue-ui'
import InitialSyncGate from '../components/initial-sync-gate.vue'

/**
 * 测试专用 IndexedDB shim 见 `./setup-fake-indexeddb`（**必须是第一条 import**：
 * `fake-indexeddb` 属 infra 的 devDependency，且 Dexie 在模块加载时即捕获 `indexedDB`）。
 */

/**
 * DEF-6 / AC13 **端到端**回归线（qa 侧）—— 桌面冷启动 1 次后本地镜像含最新任务
 *
 * **验收判据**（PRD §7 AC13）：`G` >200 行账号 ／ `W` **启动 1 次** ／ `T` 本地**含最新任务**（连续拉取）。
 *
 * **与 `rd-be-T103` 单测的分工**（PM 裁定 2026-09-23）：
 * - T103 拥有 `packages/infrastructure/src/persistence-sync/__tests__/def6-mirror-completeness.test.ts`
 *   ⇒ 覆盖 **SyncService 层**（续拉/游标/取尽判定）。
 * - 本文件只补 **端到端**：**真实 `InitialSyncGate`**（`start()` 的唯一生产入口）
 *   → 真实 `SyncService`（注入契约替身 requester）→ 真实 Dexie（`fake-indexeddb`）+ 真实 `cryptoService`
 *   ⇒ 断言「启动 1 次」这一**用户可见行为**成立；不重复 T103 的层内断言。
 *
 * 替身 requester 与服务端 `/sync/pull` keyset 语义同构（`updated_at ASC` + `(updated_at,id)` 游标 + `limit`）。
 */

/** 夹具 + 替身 requester（`vi.hoisted`：必须早于 `vi.mock` 工厂求值） */
const fx = vi.hoisted(() => {
    const TOTAL = 250
    const FIXTURE_BASE_MS = Date.UTC(2026, 0, 1, 0, 0, 0)
    const emptyTable = { items: [], total: 0, nextCursor: '', nextCursorId: '' }
    const remoteTask = (index: number): Record<string, unknown> => {
        const updatedAt = new Date(FIXTURE_BASE_MS + index * 1000).toISOString()
        return {
            id: `t-${String(index).padStart(4, '0')}`,
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
    const remote = Array.from({ length: TOTAL }, (_, index) => remoteTask(index))
    /** 诊断计数：替身 requester 是否真被 app 级单例使用 */
    const stats = { pullCalls: 0 }
    const requester = {
        post: async (url: string, body: unknown) => {
            if (url !== '/sync/pull') return { data: { results: [] }, serverTime: Date.now() }
            stats.pullCalls += 1
            const cursor =
                (body as { tasks?: { updatedAt?: string; cursorId?: string; limit?: number } })
                    .tasks ?? {}
            const cursorAt = cursor.updatedAt ?? ''
            const cursorId = cursor.cursorId ?? ''
            const limit = cursor.limit ?? 200
            const after = remote.filter((row) => {
                if (cursorAt === '') return true
                const at = row['updatedAt'] as string
                const id = row['id'] as string
                return at > cursorAt || (at === cursorAt && cursorId !== '' && id > cursorId)
            })
            const page = after.slice(0, limit)
            const last = page[page.length - 1]
            return {
                data: {
                    data: {
                        data: {
                            tasks: {
                                items: page,
                                total: page.length,
                                nextCursor: (last?.['updatedAt'] as string) ?? '',
                                nextCursorId: (last?.['id'] as string) ?? ''
                            },
                            taskCheckItems: emptyTable,
                            taskComments: emptyTable,
                            projects: emptyTable,
                            tags: emptyTable,
                            pomodoros: emptyTable,
                            pomodoroRecords: emptyTable
                        }
                    },
                    serverTime: Date.now()
                }
            }
        },
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    }
    return { TOTAL, NEWEST_ID: `t-${String(TOTAL - 1).padStart(4, '0')}`, requester, stats }
})

/**
 * 把 app 级单例 `syncService` 换成「真实 `SyncService` + 契约替身 requester」。
 * 其余基础设施（`localDatabase` / `cryptoService` / `localSession` / `syncTracker` / `syncStatus`）保持真实。
 */
vi.mock('@nao-todo/infrastructure', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@nao-todo/infrastructure')>()
    return { ...actual, syncService: new actual.SyncService(fx.requester as never) }
})

const { cryptoService, localDatabase, localSession } = await import('@nao-todo/infrastructure')

let wrapper: VueWrapper | null = null

/** 轮询等待（真实计时器；同步为真实异步落库） */
const waitFor = async (
    probe: () => Promise<boolean>,
    { timeoutMs = 20000, stepMs = 100 } = {}
): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (await probe()) return true
        await new Promise((resolve) => setTimeout(resolve, stepMs))
    }
    return false
}

const mountGate = (): VueWrapper => {
    wrapper = mount(InitialSyncGate, {
        global: {
            plugins: [createPinia()],
            components: {
                'nue-main': NueMain,
                'nue-div': NueDiv,
                'nue-text': NueText,
                'nue-button': NueButton
            }
        }
    })
    return wrapper
}

describe('DEF-6 / AC13（端到端）：冷启动 1 次 ⇒ 本地镜像含最新任务', () => {
    beforeEach(async () => {
        if (!globalThis.crypto?.subtle) {
            Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
        }
        await localDatabase.tasks.clear()
        await localDatabase.syncQueue.clear()
        await localDatabase.syncCursor.clear()
        await localDatabase.deletionSchedules.clear()
        await localDatabase.meta.clear()
        cryptoService.lock()
        localSession.setCurrentUserId('u-1')
        await cryptoService.setup('u-1', 'test-password')
    })

    afterEach(() => {
        wrapper?.unmount()
        wrapper = null
    })

    it('挂载 InitialSyncGate（= 启动 1 次）⇒ 本地落满 250 行且含最新任务', async () => {
        mountGate()

        await waitFor(async () => (await localDatabase.tasks.count()) === fx.TOTAL)
        await flushPromises()

        // 带诊断：失败时直接可见「落库数 / 最新行是否存在 / 替身 requester 被调用次数」
        expect({
            count: await localDatabase.tasks.count(),
            hasNewest: Boolean(await localDatabase.tasks.get(fx.NEWEST_ID)),
            pullCalls: fx.stats.pullCalls
        }).toEqual({ count: fx.TOTAL, hasNewest: true, pullCalls: expect.any(Number) })
    }, 30000)

    it('门进入终态（emit synced），不永久停在 syncing', async () => {
        mountGate()

        const synced = await waitFor(async () => Boolean(wrapper?.emitted('synced')))
        expect(synced).toBe(true)
    }, 30000)
})