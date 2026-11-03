// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import {
    localDatabase,
    type ProjectRecord,
    type TagRecord
} from '../../persistence-local/db/local-database'
import { projectRecordToEntity } from '../../persistence-local/converters/project'
import { tagRecordToEntity } from '../../persistence-local/converters/tag'
import { localSession } from '../../persistence-local/session/local-session'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { KNOWN_UNSUPPORTED_PUSH_FIELDS, isKnownUnsupportedPushField } from '../dropped-fields'
import { SYNC_TABLES } from '../sync-service'
import { SyncService } from '../sync-service'

/**
 * T641 / `A6`（`F-06`，架构复核后收敛）用例先行（红基线）—— `icon` 收口为「契约不承载」
 *
 * 契约真源：PRD AC5 / §三 A6 · `T640` **Q5**（`icon` 是唯一真缺口，无写入口径 ⇒ **移出契约**，
 *          零 DDL；白名单同步收敛；拉取侧不再硬编码覆盖）。
 *
 * 覆盖（现状**红**）：
 * ① `SYNC_TABLES.entityToPush` 的 `projects` / `tags` **不再包含 `icon`**；
 * ② `SYNC_PUSH_DROPPED_FIELDS` 白名单只剩「已确认仅本机」项（与服务端承载集镜像**精确相等**）；
 * ③ 拉取侧**不再硬编码覆盖**本地 `icon`（project / tag 各 1 例）。
 *
 * 现绿护栏：其余 4 项（`sortId` / `attachments` / `isTopUp` / `checkItem.description`）由
 * `dropped-fields.test.ts` 的契约镜像守护，本文件只对其余「已确认仅本机」项做精确相等断言。
 */

const USER_ID = 't641-a6-user'
const CREATED = '2029-01-01T00:00:00.000Z'
const BASE = '2029-02-01T00:00:00.000Z'
const NEWER = '2029-06-01T00:00:00.000Z'

const EMPTY_TABLE = { items: [], total: 0, nextCursor: '', nextCursorId: '' }
const EMPTY_PULL_DATA = {
    tasks: EMPTY_TABLE,
    projects: EMPTY_TABLE,
    tags: EMPTY_TABLE,
    taskCheckItems: EMPTY_TABLE,
    taskComments: EMPTY_TABLE,
    pomodoros: EMPTY_TABLE,
    pomodoroRecords: EMPTY_TABLE
}

const mockRequester = (handler: (url: string) => unknown): Requester =>
    ({
        post: async (url: string) => ({ data: handler(url) }),
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    }) as unknown as Requester

const pullEnvelope = (tables: Record<string, unknown>) => ({
    code: 90020,
    message: 'ok',
    data: { data: { ...EMPTY_PULL_DATA, ...tables }, serverTime: String(Date.now()) }
})

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
    localStorage.clear()
    cryptoService.lock()
    localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-t641-a6')
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
}

/** 以「万能实体」跑 `entityToPush`，取该表客户端真正会发送的键集 */
const sentKeysOf = (table: string): Set<string> => {
    const config = SYNC_TABLES.find((c) => c.table === table)
    if (!config) throw new Error(`未配置的同步表: ${table}`)
    const entity = new Proxy({}, { get: () => 1 }) as Record<string, unknown>
    return new Set(Object.keys(config.entityToPush(entity)))
}

/** 移出 `icon` 后的「已确认仅本机」承载差集（与服务端承载集镜像精确相等） */
const EXPECTED_UNSUPPORTED: Record<string, string[]> = {
    projects: [],
    tags: [],
    tasks: [],
    taskCheckItems: ['deletedAt'],
    taskComments: ['deletedAt'],
    pomodoros: ['totalDuration'],
    pomodoroRecords: ['deletedAt']
}

describe('T641 / A6 `icon` 移出同步契约', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('AC5 entityToPush：projects / tags 不再包含 icon（其余表不受影响）', () => {
        // 现状红：projects/tags 的 buildPush 字段列表含 'icon'
        expect(sentKeysOf('projects').has('icon')).toBe(false)
        expect(sentKeysOf('tags').has('icon')).toBe(false)
        // 既有业务字段不得被连带删除（`sortId` 已入契约，必须继续发送）
        expect(sentKeysOf('projects').has('sortId')).toBe(true)
        expect(sentKeysOf('tags').has('sortId')).toBe(true)
        expect(sentKeysOf('projects').has('name')).toBe(true)
        expect(sentKeysOf('tags').has('color')).toBe(true)
    })

    it('AC5 白名单只剩「已确认仅本机」项（精确相等；icon 清零）', () => {
        // 现状红：projects/tags 白名单各含 'icon'
        expect(isKnownUnsupportedPushField('projects', 'icon')).toBe(false)
        expect(isKnownUnsupportedPushField('tags', 'icon')).toBe(false)

        for (const { table } of SYNC_TABLES) {
            const expected = EXPECTED_UNSUPPORTED[table]
            expect(expected, `缺少期望值: ${table}`).toBeDefined()
            const actual = [...(KNOWN_UNSUPPORTED_PUSH_FIELDS[table] ?? [])].sort()
            expect(actual, `白名单与「已确认仅本机」集不一致: ${table}`).toEqual(expected)
        }
    })

    it('AC5 拉取 project 不再硬编码覆盖本地 icon（其余字段照常覆盖）', async () => {
        const projectId = 'p-t641-icon'
        await localDatabase.projects.put({
            id: projectId,
            userId: USER_ID,
            name: await cryptoService.encrypt('本地清单'),
            icon: 'star',
            description: null,
            createdAt: CREATED,
            updatedAt: BASE,
            deletedAt: null,
            archivedAt: null,
            deactivedAt: null,
            sortId: 0,
            taskCount: 0,
            syncedServerUpdatedAt: BASE
        } satisfies ProjectRecord)

        const remoteProject = {
            id: projectId,
            createdAt: CREATED,
            updatedAt: NEWER,
            deletedAt: null,
            name: '云端清单',
            description: '',
            archivedAt: null,
            deactivedAt: null,
            sortId: 1,
            taskCount: 2
        }
        const service = new SyncService(
            mockRequester((url) =>
                url === '/sync/pull'
                    ? pullEnvelope({
                          projects: { ...EMPTY_TABLE, items: [remoteProject], total: 1 }
                      })
                    : { data: {} }
            )
        )

        await service.pullAll()

        const raw = (await localDatabase.projects.get(projectId)) as ProjectRecord | undefined
        expect(raw).toBeTruthy()
        // 现状红：projectRes2Entity 硬编码 icon='more2' ⇒ 覆盖本地 'star'
        expect(raw?.icon).toBe('star')
        // 证明本次 pull 真的生效（不是没写）
        const entity = await projectRecordToEntity(raw as ProjectRecord)
        expect(entity.name).toBe('云端清单')
        expect(entity.updatedAt).toBe(NEWER)
        expect(raw?.syncedServerUpdatedAt).toBe(NEWER)
    })

    it('AC5 拉取 tag 不再硬编码覆盖本地 icon（其余字段照常覆盖）', async () => {
        const tagId = 'g-t641-icon'
        await localDatabase.tags.put({
            id: tagId,
            userId: USER_ID,
            icon: 'tag-custom',
            name: await cryptoService.encrypt('本地标签'),
            description: await cryptoService.encrypt(''),
            color: '#111111',
            sortId: 0,
            createdAt: CREATED,
            updatedAt: BASE,
            deletedAt: null,
            syncedServerUpdatedAt: BASE
        } satisfies TagRecord)

        const remoteTag = {
            id: tagId,
            createdAt: CREATED,
            updatedAt: NEWER,
            deletedAt: null,
            name: '云端标签',
            description: '',
            color: '#222222',
            sortId: 2
        }
        const service = new SyncService(
            mockRequester((url) =>
                url === '/sync/pull'
                    ? pullEnvelope({ tags: { ...EMPTY_TABLE, items: [remoteTag], total: 1 } })
                    : { data: {} }
            )
        )

        await service.pullAll()

        const raw = (await localDatabase.tags.get(tagId)) as TagRecord | undefined
        expect(raw).toBeTruthy()
        // 现状红：tagRes2Entity 硬编码 icon='tag'
        expect(raw?.icon).toBe('tag-custom')
        const entity = await tagRecordToEntity(raw as TagRecord)
        expect(entity.name).toBe('云端标签')
        expect(entity.color).toBe('#222222')
        expect(entity.updatedAt).toBe(NEWER)
    })
})