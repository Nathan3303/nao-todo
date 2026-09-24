// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared/requester'
import { ProjectPreferenceEntity } from '@nao-todo/domain-project'
import { TagPreferenceEntity } from '@nao-todo/domain-tag'
import { JsonStringValueObject } from '@nao-todo/shared/valueobjects/json-string'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { projectPreferenceEntityToRecord } from '../../persistence-local/converters/preference'
import { LocalProjectPreferenceRepoImpl } from '../../persistence-local/repos/project-preference-repo-impl'
import { newLocalTagPreferenceRepository } from '../../persistence-local/repos/tag-preference-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { enqueuePreference, loadPreferenceQueue } from '../preference-queue'
import { cancelPreferencePush, pushPreferenceQueue } from '../preference-sync'
import { syncStatus } from '../sync-status'

/**
 * T162 用例先行（红基线）—— 阶段二 2B · 面 ⑤ 偏好面收口（`T141` + `DP-5`）
 *
 * 契约（ADR §9.4 / §9.6 R-17 / R-18；PS-1/PS-10 不变）：
 * - **DP-5**：`LocalTagPreferenceRepoImpl.save` 入**偏好队列**（`kind: 'tagPreference'`）
 *   + 两端同构；**通道仍独立** ⇒ **禁入业务 `syncQueue`**（`countDirty === 0`）；
 * - **T141**：普通清单偏好复用**同一 per-row 版本字段语义**（§9.4.1）：
 *   push 成功后落 `syncedServerUpdatedAt`（服务端 `updatedAt`）；读时对账升级
 *   = 本地 base 落后于服务端 ⇒ **远端胜**（不覆盖服务端）。
 *
 * ⚠️ **已核对的契约冲突（回报 PM，未覆盖他人用例）**：既有绿测
 *   `preference-sync.test.ts`「本地有值 ⇒ 本地优先（不发服务端请求，PS-1b）」断言
 *   `get` **零调用**，与 §9.4.1「服务端 `updatedAt > syncedServerUpdatedAt` ⇒ 拉取并应用」
 *   **直接冲突** ⇒ 后者需 T168 同批修订既有用例，方能转绿。
 *
 * **红窗口**：DP-5 队列项、T141 写回 / 读时对账预期**红**（T168/W4 落地后转绿）。
 */

const USER_ID = 'u-1'
const EMAIL = 'u@example.com'
const OLD = '2026-01-02T00:00:00.000Z'
const NEW = '2026-01-03T00:00:00.000Z'

const makeRequester = (overrides: Partial<Requester> = {}): Requester =>
    ({
        _instance: null,
        name: 'AxiosRequester',
        baseURL: '',
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        ...overrides
    }) as unknown as Requester

const json = (raw = '{}'): JsonStringValueObject => JsonStringValueObject.CreateByJsonString(raw)

const localProjectPreference = async (viewType = 'table'): Promise<void> => {
    await localDatabase.projectPreferences.put(
        await projectPreferenceEntityToRecord(
            new ProjectPreferenceEntity('', OLD, OLD, null, 'p-1', viewType, json(), json()),
            USER_ID
        )
    )
}

const setProjectPreferenceBase = async (value: string): Promise<void> => {
    const record = await localDatabase.projectPreferences.where('projectId').equals('p-1').first()
    await localDatabase.projectPreferences.put({
        ...record!,
        syncedServerUpdatedAt: value
    } as never)
}

const projectPreferenceBase = async (): Promise<unknown> => {
    const record = (await localDatabase.projectPreferences
        .where('projectId')
        .equals('p-1')
        .first()) as unknown as Record<string, unknown> | undefined
    return record?.syncedServerUpdatedAt
}

beforeEach(async () => {
    localStorage.clear()
    await localDatabase.meta.clear()
    await localDatabase.syncQueue.clear()
    await localDatabase.projectPreferences.clear()
    await localDatabase.tagPreferences.clear()
    await localDatabase.tasks.clear()
    cryptoService.lock()
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'pw')
    syncStatus.reportPreferencePush({ pushed: 0, failed: 0 })
})

afterEach(() => {
    cancelPreferencePush()
    vi.restoreAllMocks()
})

describe('面 ⑤ DP-5 标签偏好入偏好队列（两端同构，通道独立）', () => {
    it('save ⇒ 本地行落库 + 偏好队列 kind=tagPreference + 不入业务 syncQueue', async () => {
        const repo = newLocalTagPreferenceRepository()

        const err = await repo.save(
            new TagPreferenceEntity('', OLD, OLD, null, 'tag-1', 'kanban', json(), json())
        )

        expect(err).toBeNull()
        expect(await localDatabase.tagPreferences.count()).toBe(1)
        const items = await loadPreferenceQueue(USER_ID)
        expect(items).toHaveLength(1)
        expect(String(items[0]!.kind)).toBe('tagPreference')
        expect((items[0] as unknown as Record<string, unknown>).tagId).toBe('tag-1')
        // PS-1/PS-10：偏好通道独立，禁入业务 syncQueue
        expect(await localDatabase.syncQueue.count()).toBe(0)
    })
})

describe('面 ⑤ T141 普通清单偏好 per-row 版本（复用 §9.1 基建，通道独立）', () => {
    it('push 成功（服务端回 updatedAt）⇒ 落 syncedServerUpdatedAt（§9.4.1 写回）', async () => {
        await localProjectPreference('kanban')
        await enqueuePreference(USER_ID, { kind: 'projectPreference', projectId: 'p-1' })
        const post = vi.fn(async () => ({ data: { code: 20090, data: { updatedAt: NEW } } }))

        const result = await pushPreferenceQueue({
            requester: makeRequester({ post }),
            storage: localStorage,
            email: EMAIL
        })

        expect(result).toEqual({ pushed: 1, failed: 0 })
        expect(await projectPreferenceBase()).toBe(NEW)
        // 通道独立：不写业务 syncQueue
        expect(await localDatabase.syncQueue.count()).toBe(0)
    })

    it('读时对账升级：本地 base 落后服务端 ⇒ 远端胜（§9.4.1；⚠️ 与既有 PS-1b 用例冲突，见文件头）', async () => {
        await localProjectPreference('table')
        await setProjectPreferenceBase(OLD)
        const get = vi.fn(async () => ({
            data: {
                code: 20080,
                data: {
                    id: 'srv-1',
                    createdAt: OLD,
                    updatedAt: NEW,
                    deletedAt: null,
                    projectId: 'p-1',
                    viewType: 'kanban',
                    getTasksOptions: '{}',
                    columns: '{}'
                }
            }
        }))
        const repo = new LocalProjectPreferenceRepoImpl(localDatabase, makeRequester({ get }))

        const [pref] = await repo.getByProjectId('p-1')

        expect(pref!.viewType).toBe('kanban')
        expect(get).toHaveBeenCalled()
        expect(await projectPreferenceBase()).toBe(NEW)
    })
})