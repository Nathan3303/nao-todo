import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { UpdateUserNicknameValueObject } from '@nao-todo/domain-identity'
import { CreateTaskCheckItemValueObject, CreateTaskCommentValueObject } from '@nao-todo/domain-task'
import {
    CreatePomodoroRecordValueObject,
    CreatePomodoroValueObject
} from '@nao-todo/domain-pomodoro'
import { CreateProjectValueObject } from '@nao-todo/domain-project'
import { TagEntity } from '@nao-todo/domain-tag'
import { localDatabase } from '../db/local-database'
import { newLocalTaskRepository } from '../repos/task-repo-impl'
import { newLocalTaskCheckItemRepository } from '../repos/task-check-item-repo-impl'
import { newLocalTaskCommentRepository } from '../repos/task-comment-repo-impl'
import { newLocalProjectRepository } from '../repos/project-repo-impl'
import { newLocalTagRepository } from '../repos/tag-repo-impl'
import { newLocalPomodoroRepository } from '../repos/pomodoro-repo-impl'
import { newLocalPomodoroRecordRepository } from '../repos/pomodoro-record-repo-impl'
import { newLocalUserRepository } from '../repos/user-repo-impl'
import { syncTracker } from '../../persistence-sync/sync-tracker'
import { syncStatus } from '../../persistence-sync/sync-status'
import { SyncService } from '../../persistence-sync/sync-service'
import { makeTaskVO, setup } from './local-repos-test-helpers'

/**
 * 阶段二 2A M6 —— `markDirty` 测试口径全量同步（ADR §5 M6）
 *
 * @description 阶段一不变量「web 业务 `markDirty` 恒 0」（C-59 / AC10）已随业务 7 域切本地优先**退场**，
 *              新口径（ADR §2.1 D-2）：
 *              ① **业务 7 域**本地写 ⇒ `markDirty` 入 `syncQueue`（**不再恒 0**）；
 *              ② 运行结束时 **`pendingCount = countDirty`**（按实体去重）；
 *              ③ **成功同步 ⇒ 出队回 0**（`countDirty = 0` 且 `pendingCount = 0`）；
 *              ④ **身份域 `user`（W5）仍远端直连、不入 `SYNC_TABLES`** ⇒ 本地身份写**不计入**队列/`pendingCount`。
 *
 *              既有 `local-*-write-dirty.test.ts`（W1–W4）已逐域锁 ①；本文件补 ②③ 的运行级口径
 *              与 ④ 身份域区分（**不再为每域重复**）。
 */

/** 推送全确认（echo results）：一次运行 ⇒ 脏队列清空 */
const echoResultsRequester = (): Requester =>
    ({
        post: async (url: string, body: unknown) => {
            if (url === '/sync/pull') return { data: { data: {} }, serverTime: Date.now() }
            const payload = body as Record<string, unknown>
            const rows = Object.entries(payload).filter(([key]) => key !== 'deletions')
            const results = rows.flatMap(([table, value]) =>
                (value as { id: string }[]).map((row) => ({ table, id: row.id }))
            )
            const deletions = (payload.deletions as { table: string; id: string }[]) ?? []
            return {
                data: {
                    data: {
                        results: [
                            ...results,
                            ...deletions.map((item) => ({ table: item.table, id: item.id }))
                        ]
                    },
                    serverTime: Date.now()
                }
            }
        },
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    }) as unknown as Requester

/** 推送全未确认（results 空）：运行失败 ⇒ 脏队列保留（用于观察 pendingCount 非 0） */
const unconfirmedRequester = (): Requester =>
    ({
        post: async (url: string) =>
            url === '/sync/pull'
                ? { data: { data: {} }, serverTime: Date.now() }
                : { data: { data: { results: [] }, serverTime: Date.now() } },
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    }) as unknown as Requester

/** 业务 7 域各写一条（每域恰好 1 条脏队列项） */
const seedAllBusinessDomains = async (): Promise<void> => {
    await newLocalTaskRepository().create(makeTaskVO({ name: 'M6 任务' }))
    await newLocalTaskCheckItemRepository().create(
        new CreateTaskCheckItemValueObject('task-1', 'M6 检查项', false, false)
    )
    await newLocalTaskCommentRepository().create(
        new CreateTaskCommentValueObject('task-1', 'M6 评论', [], false)
    )
    await newLocalProjectRepository().create(new CreateProjectValueObject('M6 清单', 'more2', ''))
    await newLocalTagRepository().create(
        new TagEntity(
            '',
            new Date().toISOString(),
            new Date().toISOString(),
            null,
            'more2',
            'M6 标签',
            '',
            '#666666',
            1
        )
    )
    await newLocalPomodoroRepository().create(
        new CreatePomodoroValueObject(1, 'M6 番茄', '专注 25 分钟', 1500)
    )
    await newLocalPomodoroRecordRepository().create(
        new CreatePomodoroRecordValueObject(
            'session-1',
            1,
            new Date().toISOString(),
            new Date().toISOString(),
            1500,
            '',
            '',
            '',
            '',
            ''
        )
    )
}

/**
 * DEF-28（flaky）隔离：`SyncService.pushAll` 会经条件退避 `setTimeout` 存活到用例之后
 * ⇒ 用例结束即清掉本用例创建的定时器（同 `sync.test.ts` 做法）。
 */
const timersCreatedInTest = new Set<ReturnType<typeof globalThis.setTimeout>>()
let realSetTimeout: typeof globalThis.setTimeout

beforeEach(async () => {
    realSetTimeout = globalThis.setTimeout
    const trackingSetTimeout = (...args: Parameters<typeof globalThis.setTimeout>) => {
        const id = realSetTimeout(...args)
        timersCreatedInTest.add(id)
        return id
    }
    globalThis.setTimeout = trackingSetTimeout as typeof globalThis.setTimeout

    await setup()
    await localDatabase.syncQueue.clear()
    await localDatabase.syncCursor.clear()
})

afterEach(() => {
    for (const id of timersCreatedInTest) clearTimeout(id)
    timersCreatedInTest.clear()
    globalThis.setTimeout = realSetTimeout
})

describe('M6 markDirty 口径：业务 7 域不再恒 0', () => {
    it('业务 7 域各写一条 ⇒ countDirty=7、队列表覆盖 7 表（不再恒 0）', async () => {
        await seedAllBusinessDomains()

        expect(await syncTracker.countDirty('test-user')).toBe(7)
        const tables = (await syncTracker.listDirty('test-user')).map((item) => item.table).sort()
        expect(tables).toEqual([
            'pomodoroRecords',
            'pomodoros',
            'projects',
            'tags',
            'taskCheckItems',
            'taskComments',
            'tasks'
        ])
    })

    it('运行结束 ⇒ pendingCount = countDirty（非 0：未确认脏队列保留）', async () => {
        await seedAllBusinessDomains()
        const service = new SyncService(unconfirmedRequester())

        const result = await service.pushAll()

        expect(result.ok).toBe(false)
        const dirty = await syncTracker.countDirty('test-user')
        expect(dirty).toBe(7)
        expect(syncStatus.get().pendingCount).toBe(dirty)
    })

    it('成功同步 ⇒ 出队回 0 且 pendingCount = 0', async () => {
        await seedAllBusinessDomains()
        const service = new SyncService(echoResultsRequester())

        const result = await service.pushAll()

        expect(result.ok).toBe(true)
        expect(await syncTracker.countDirty('test-user')).toBe(0)
        expect(syncStatus.get().pendingCount).toBe(0)
    })
})

describe('M6 markDirty 口径：身份域（user）仍远端直连、不入 syncQueue', () => {
    it('本地身份写（LocalUserRepoImpl）不 markDirty ⇒ countDirty 恒 0、不计入 pendingCount', async () => {
        // 造一条本地用户资料（身份域桌面形态），使 updateNickname 真实落库（非因缺失记录而空转）
        const now = new Date().toISOString()
        await localDatabase.users.put({
            id: 'default',
            userId: 'test-user',
            email: 'plain:u@example.com',
            nickname: 'plain:旧昵称',
            avatar: 'plain:',
            createdFrom: 'web',
            role: 'user',
            state: 1,
            deactivedAt: '',
            lastRestoreAt: '',
            createdAt: now,
            updatedAt: now,
            deletedAt: null
        })

        const markDirty = vi.spyOn(syncTracker, 'markDirty')
        const err = await newLocalUserRepository().updateNickname(
            new UpdateUserNicknameValueObject('新昵称')
        )

        expect(err).toBeNull()
        expect(markDirty).not.toHaveBeenCalled()
        expect(await syncTracker.countDirty('test-user')).toBe(0)

        // 运行一遍：身份域无脏项 ⇒ 不计入 pendingCount
        const result = await new SyncService(echoResultsRequester()).pushAll()
        expect(result.ok).toBe(true)
        expect(syncStatus.get().pendingCount).toBe(0)
    })
})