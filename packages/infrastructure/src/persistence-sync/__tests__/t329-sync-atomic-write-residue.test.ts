// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { JsonStringValueObject } from '@nao-todo/shared/valueobjects/json-string'
import {
    CreatePomodoroRecordValueObject,
    CreatePomodoroValueObject
} from '@nao-todo/domain-pomodoro'
import { ProjectPreferenceEntity } from '@nao-todo/domain-project'
import { TagEntity, TagPreferenceEntity } from '@nao-todo/domain-tag'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalPomodoroRecordRepository } from '../../persistence-local/repos/pomodoro-record-repo-impl'
import { newLocalPomodoroRepository } from '../../persistence-local/repos/pomodoro-repo-impl'
import { newLocalProjectPreferenceRepository } from '../../persistence-local/repos/project-preference-repo-impl'
import { newLocalTagPreferenceRepository } from '../../persistence-local/repos/tag-preference-repo-impl'
import { newLocalTagRepository } from '../../persistence-local/repos/tag-repo-impl'
import { projectPreferenceEntityToRecord } from '../../persistence-local/converters/preference'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { appendConflict, resolveConflictRetryLocal } from '../conflict-journal'
import { preferenceQueueId } from '../preference-queue'
import { reconcilePreferences } from '../preference-sync'
import { syncStatus } from '../sync-status'
import { syncTracker } from '../sync-tracker'

/**
 * T329 /（`DEF-50` 残余）—— 把「写库 + 入队同事务」补齐到 `T326` 之外的残余写路径。
 *
 * 覆盖（与 `T326` 同型机制 `putWithSyncBaseAndEnqueue` / 同型 `rw` 事务）：
 * - `tags` / `pomodoros` / `pomodoroRecords` / 冲突「以我的版本重试」/ 偏好队列（project/tag）：
 *   **入队失败 ⇒ 业务写整体回滚**（「行写入与队列项同生共死」等价断言）；
 * - 偏好 `reconcilePreferences` 覆盖侧：**事务内再确认**队列 ⇒ 并发本地写不被静默覆盖。
 */

const USER_ID = 't329-user'
const ISO = '2032-01-01T00:00:00.000Z'

const taskVO = (name: string): CreateTaskValueObject =>
    new CreateTaskValueObject(
        null,
        null,
        name,
        '',
        'todo',
        'medium',
        null,
        null,
        'p-1',
        [],
        null,
        'none',
        null,
        []
    )

const preferenceJson = (): JsonStringValueObject => JsonStringValueObject.CreateByJsonString('[]')

const projectPreferenceEntity = (
    id: string,
    projectId: string,
    viewType: string,
    updatedAt = ISO
): ProjectPreferenceEntity =>
    new ProjectPreferenceEntity(
        id,
        ISO,
        updatedAt,
        null,
        projectId,
        viewType,
        preferenceJson(),
        preferenceJson()
    )

const tagPreferenceEntity = (
    id: string,
    tagId: string,
    viewType: string,
    updatedAt = ISO
): TagPreferenceEntity =>
    new TagPreferenceEntity(
        id,
        ISO,
        updatedAt,
        null,
        tagId,
        viewType,
        preferenceJson(),
        preferenceJson()
    )

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
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
    syncStatus.setConflictCount(0)
}

describe('T329 / DEF-50 残余写路径原子化', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    describe('入队失败 ⇒ 业务写整体回滚（同生共死）', () => {
        it('tags.create：markDirty 失败 ⇒ 不落库', async () => {
            const spy = vi
                .spyOn(syncTracker, 'markDirty')
                .mockRejectedValueOnce(new Error('queue-unavailable'))
            const repo = newLocalTagRepository()
            const [, err] = await repo.create(
                new TagEntity('', ISO, ISO, null, 'tag', '标签', '', '#fff', 1)
            )
            spy.mockRestore()
            expect(err).not.toBeNull()
            expect(await localDatabase.tags.count()).toBe(0)
        })

        it('pomodoros.create：markDirty 失败 ⇒ 不落库', async () => {
            const spy = vi
                .spyOn(syncTracker, 'markDirty')
                .mockRejectedValueOnce(new Error('queue-unavailable'))
            const repo = newLocalPomodoroRepository()
            const [, err] = await repo.create(new CreatePomodoroValueObject(1, '专注', '', 25))
            spy.mockRestore()
            expect(err).not.toBeNull()
            expect(await localDatabase.pomodoros.count()).toBe(0)
        })

        it('pomodoroRecords.create：markDirty 失败 ⇒ 记录不落库', async () => {
            const spy = vi
                .spyOn(syncTracker, 'markDirty')
                .mockRejectedValueOnce(new Error('queue-unavailable'))
            const repo = newLocalPomodoroRecordRepository()
            const [, err] = await repo.create(
                new CreatePomodoroRecordValueObject('s-1', 1, ISO, ISO, 1500, '', '', '', '', '')
            )
            spy.mockRestore()
            expect(err).not.toBeNull()
            expect(await localDatabase.pomodoroRecords.count()).toBe(0)
        })

        it('冲突「以我的版本重试」：markDirty 失败 ⇒ 败方不写回本地', async () => {
            const repo = newLocalTaskRepository()
            const [task] = await repo.create(taskVO('原名'))
            const id = (task as { id: string }).id
            // 造一条 journal：loser 为「改名后的本地快照」
            const [entity] = await repo.get(id)
            await appendConflict(USER_ID, {
                kind: 'remote-wins',
                table: 'tasks',
                entityId: id,
                loser: { ...(entity as unknown as Record<string, unknown>), name: '败方名' }
            })
            const spy = vi
                .spyOn(syncTracker, 'markDirty')
                .mockRejectedValueOnce(new Error('queue-unavailable'))
            await expect(resolveConflictRetryLocal(USER_ID, 'tasks', id)).rejects.toThrow()
            spy.mockRestore()
            const [after] = await repo.get(id)
            expect((after as { name: string } | null)?.name).toBe('原名')
        })

        it('projectPreference.save：入队失败 ⇒ 业务行回滚', async () => {
            const spy = vi
                .spyOn(localDatabase.meta, 'put')
                .mockRejectedValueOnce(new Error('queue-unavailable'))
            const repo = newLocalProjectPreferenceRepository()
            const err = await repo.save(projectPreferenceEntity('pp-1', 'p-1', 'table'))
            spy.mockRestore()
            expect(err).not.toBeNull()
            expect(await localDatabase.projectPreferences.count()).toBe(0)
        })

        it('tagPreference.save：入队失败 ⇒ 业务行回滚', async () => {
            const spy = vi
                .spyOn(localDatabase.meta, 'put')
                .mockRejectedValueOnce(new Error('queue-unavailable'))
            const repo = newLocalTagPreferenceRepository()
            const err = await repo.save(tagPreferenceEntity('tp-1', 'tag-1', 'table'))
            spy.mockRestore()
            expect(err).not.toBeNull()
            expect(await localDatabase.tagPreferences.count()).toBe(0)
        })
    })

    describe('偏好对账覆盖侧：事务内再确认（不静默覆盖未推本地值）', () => {
        it('reconcile 首读队列后本地写抢先入队 ⇒ 放弃覆盖（保留本地值）', async () => {
            // 播种一条带 base 的本地偏好行（本地值 = local-view）
            const seeded = await projectPreferenceEntityToRecord(
                projectPreferenceEntity('pp-1', 'p-1', 'local-view'),
                USER_ID
            )
            await localDatabase.projectPreferences.put({
                ...seeded,
                syncedServerUpdatedAt: ISO
            })

            const remoteUpdatedAt = '2033-01-01T00:00:00.000Z'
            const requester = {
                get: async () => ({
                    data: {
                        code: 20080,
                        data: {
                            id: 'pp-1',
                            createdAt: ISO,
                            updatedAt: remoteUpdatedAt,
                            deletedAt: null,
                            projectId: 'p-1',
                            viewType: 'remote-view',
                            getTasksOptions: '[]',
                            columns: '[]'
                        }
                    }
                }),
                post: async () => ({ data: {} }),
                put: async () => ({ data: {} }),
                delete: async () => ({ data: {} })
            } as unknown as Requester

            // 在 reconcile 首次读偏好队列（空）之后，注入一次本地写入队（模拟 TOCTOU 窗口）
            let injected = false
            const realGet = localDatabase.meta.get.bind(localDatabase.meta)
            const spy = vi.spyOn(localDatabase.meta, 'get').mockImplementation((async (
                key: string
            ) => {
                const result = await realGet(key)
                if (!injected && String(key).includes(':preference-queue')) {
                    injected = true
                    await localDatabase.meta.put({
                        id: preferenceQueueId(USER_ID),
                        preferenceQueue: [
                            {
                                kind: 'projectPreference',
                                projectId: 'p-1',
                                createdAt: ISO
                            }
                        ]
                    })
                }
                return result
            }) as never)

            await reconcilePreferences({ requester })
            spy.mockRestore()

            const row = await localDatabase.projectPreferences.get('pp-1')
            // 改前必红：覆盖侧无再确认 ⇒ 行被远端覆盖
            expect(row?.viewType).toBe('local-view')
            expect(row?.syncedServerUpdatedAt).toBe(ISO)
        })
    })
})