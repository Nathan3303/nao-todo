import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { cryptoService } from '../crypto/crypto-service'
import { localDatabase, type TaskRecord } from '../db/local-database'
import { localSession } from '../session/local-session'
import { seedLegacyCipher } from './legacy-cipher'
import { selfHealLegacyCipherMirror } from '../migration/legacy-cipher-self-heal'
import { hasLegacyCipherResidue, isPlaintextMigrationDone } from '../migration/plaintext-migration'
import { loadMirrorStatus } from '../../persistence-sync/mirror-status-store'
import { enqueuePreference } from '../../persistence-sync/preference-queue'
import { syncTracker } from '../../persistence-sync/sync-tracker'
import { newLocalTaskRepository } from '../repos/task-repo-impl'

/**
 * web 旧密文一次性自愈（DEF-35 / C-68）—— 回归矩阵 5 项 + 负向
 *
 * 判据（证伪探针报告 §五）：**必须在 repo 层断言**（不得只做 UI 目视）——
 * 修复前 `repo.get(id)` 返回「本地密钥未解锁」（行不可见）；自愈后密文副本被丢弃，
 * 全量重拉（模拟明文落库）后 `repo.get(id)` 返回实体且 `name` 为明文。
 */

const USER_ID = 'u-1'
const PASSWORD = 'test-password'

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
}

const makeTaskRecord = async (
    id: string,
    userId: string,
    encrypt: (plain: string) => Promise<string>
): Promise<TaskRecord> => ({
    id,
    userId,
    parentTaskId: '',
    name: await encrypt('任务'),
    description: await encrypt('描述'),
    state: 'todo',
    priority: 'medium',
    startAt: '',
    endAt: '',
    projectId: '',
    tags: [],
    archivedAt: null,
    starMarkAt: null,
    givenUpAt: null,
    remindAt: '',
    remindRepeat: 'none',
    remindTime: '',
    remindWeekdays: [],
    checkItemCount: 0,
    commentCount: 0,
    subtaskCount: 0,
    sortId: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    deletedAt: null
})

/** 已是明文姿态的记录（模拟全量重拉后的落库形态） */
const plainTaskRecord = (id: string, userId: string): TaskRecord => ({
    id,
    userId,
    parentTaskId: '',
    name: 'plain:任务',
    description: 'plain:描述',
    state: 'todo',
    priority: 'medium',
    startAt: '',
    endAt: '',
    projectId: '',
    tags: [],
    archivedAt: null,
    starMarkAt: null,
    givenUpAt: null,
    remindAt: '',
    remindRepeat: 'none',
    remindTime: '',
    remindWeekdays: [],
    checkItemCount: 0,
    commentCount: 0,
    subtaskCount: 0,
    sortId: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    deletedAt: null
})

describe('web 旧密文一次性自愈（DEF-35 / C-68）', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('① 纯 web 冷启动（无密文、无密钥包）⇒ 零行为变化', async () => {
        expect(await hasLegacyCipherResidue(USER_ID)).toBe(false)
        expect(await selfHealLegacyCipherMirror(USER_ID)).toEqual({ action: 'none' })
        expect(await localDatabase.syncQueue.count()).toBe(0)
    })

    it('② 有密文 + countDirty=0 ⇒ 修复前 repo 层不可读；自愈后重拉可见且为明文', async () => {
        const legacy = await seedLegacyCipher(USER_ID, PASSWORD)
        await localDatabase.tasks.put(await makeTaskRecord('t-1', USER_ID, legacy.encrypt))
        await localDatabase.syncCursor.put({
            id: `${USER_ID}:tasks`,
            userId: USER_ID,
            table: 'tasks',
            lastPullAt: '2024-01-02T00:00:00.000Z',
            lastPullId: 't-1',
            updatedAt: '2024-01-02T00:00:00.000Z'
        })
        const repo = newLocalTaskRepository()

        // 修复前：密文不可读 ⇒ repo 层返回「本地密钥未解锁」（行不可见，而非渲染密文）
        const [before, beforeErr] = await repo.get('t-1')
        expect(before).toBeNull()
        expect(beforeErr).toMatch(/本地密钥未解锁/)

        const outcome = await selfHealLegacyCipherMirror(USER_ID)
        expect(outcome).toEqual({ action: 'healed' })

        // 密文副本已丢弃 + 游标已重置（⇒ 下次 start() 全量重拉）
        expect(await localDatabase.tasks.get('t-1')).toBeUndefined()
        expect(await localDatabase.syncCursor.where('userId').equals(USER_ID).count()).toBe(0)
        // 完成标记已写（防每次启动重复自愈）；镜像不再谎报新鲜
        expect(await isPlaintextMigrationDone(USER_ID)).toBe(true)
        expect((await loadMirrorStatus(USER_ID))?.mirrorPulledAt ?? null).toBeNull()
        // 负向：自愈直写表 ⇒ 不入队、不 markDirty（不得用默认值反向覆盖服务端）
        expect(await localDatabase.syncQueue.count()).toBe(0)
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)

        // 丢弃后、重拉前：repo 层不再报「未解锁」（行已不存在）
        const [during, duringErr] = await repo.get('t-1')
        expect(during).toBeNull()
        expect(duringErr).toBe('任务不存在')

        // 模拟服务端全量重拉落库（明文）⇒ repo 层可读且为明文
        await localDatabase.tasks.put(plainTaskRecord('t-1', USER_ID))
        const [after, afterErr] = await repo.get('t-1')
        expect(afterErr).toBeNull()
        expect(after?.name).toBe('任务')
        expect((await localDatabase.tasks.get('t-1'))!.name).toBe('plain:任务')
    })

    it('③ 有密文 + countDirty>0 ⇒ 阻塞，不丢弃本地未回传写入', async () => {
        const legacy = await seedLegacyCipher(USER_ID, PASSWORD)
        await localDatabase.tasks.put(await makeTaskRecord('t-1', USER_ID, legacy.encrypt))
        await syncTracker.markDirty('tasks', 't-1', 'upsert', '2024-01-03T00:00:00.000Z')
        expect(await syncTracker.countDirty(USER_ID)).toBe(1)

        const outcome = await selfHealLegacyCipherMirror(USER_ID)
        expect(outcome).toEqual({ action: 'blocked', pending: 1 })

        // 未丢弃、未写标记
        expect(await localDatabase.tasks.get('t-1')).toBeDefined()
        expect(await isPlaintextMigrationDone(USER_ID)).toBe(false)
        expect(await localDatabase.meta.get(`${USER_ID}:key-bundle`)).toBeDefined()
    })

    it('④ 仅存在 key-bundle（无完成标记）⇒ 判为残留；自愈后 key-bundle 不删且幂等', async () => {
        await seedLegacyCipher(USER_ID, PASSWORD)
        expect(await hasLegacyCipherResidue(USER_ID)).toBe(true)

        expect(await selfHealLegacyCipherMirror(USER_ID)).toEqual({ action: 'healed' })

        // C-51：key-bundle 不删（唯一不可逆开关）
        expect(await localDatabase.meta.get(`${USER_ID}:key-bundle`)).toBeDefined()
        expect(await isPlaintextMigrationDone(USER_ID)).toBe(true)
        // 幂等：标记短路 ⇒ 再次无残留
        expect(await hasLegacyCipherResidue(USER_ID)).toBe(false)
        expect(await selfHealLegacyCipherMirror(USER_ID)).toEqual({ action: 'none' })
    })

    it('⑤ 已是 `plain:` 的记录 ⇒ 前缀判据不误判（不触发自愈、记录不动）', async () => {
        const record = plainTaskRecord('t-1', USER_ID)
        await localDatabase.tasks.put(record)

        expect(await hasLegacyCipherResidue(USER_ID)).toBe(false)
        expect(await selfHealLegacyCipherMirror(USER_ID)).toEqual({ action: 'none' })
        expect(await localDatabase.tasks.get('t-1')).toEqual(record)
    })

    it('偏好队列有未回传项 ⇒ 同样阻塞（不得静默丢本地偏好修改）', async () => {
        const legacy = await seedLegacyCipher(USER_ID, PASSWORD)
        await localDatabase.tasks.put(await makeTaskRecord('t-1', USER_ID, legacy.encrypt))
        await enqueuePreference(USER_ID, { kind: 'projectPreference', projectId: 'p-1' })

        const outcome = await selfHealLegacyCipherMirror(USER_ID)
        expect(outcome).toEqual({ action: 'blocked', pending: 1 })
        expect(await localDatabase.tasks.get('t-1')).toBeDefined()
    })

    it('按 userId 过滤：他人密文不受影响', async () => {
        const legacy = await seedLegacyCipher(USER_ID, PASSWORD)
        await localDatabase.tasks.put(await makeTaskRecord('t-mine', USER_ID, legacy.encrypt))
        const other = await makeTaskRecord('t-other', 'u-2', legacy.encrypt)
        await localDatabase.tasks.put(other)

        const outcome = await selfHealLegacyCipherMirror(USER_ID)
        expect(outcome).toEqual({ action: 'healed' })
        expect(await localDatabase.tasks.get('t-mine')).toBeUndefined()
        expect(await localDatabase.tasks.get('t-other')).toEqual(other)
    })
})