import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { cryptoService } from '../crypto/crypto-service'
import {
    localDatabase,
    type ProjectRecord,
    type TagRecord,
    type TaskRecord
} from '../db/local-database'
import { taskRecordToEntity } from '../converters/task'
import { projectRecordToEntity } from '../converters/project'
import {
    isPlaintextMigrationDone,
    plaintextMigrationMarkerId,
    runPlaintextMigration
} from '../migration/plaintext-migration'
import { seedLegacyCipher } from './legacy-cipher'

/**
 * 明文迁移器（C-47…C-51 / C-56）—— AC2 / AC3a / AC3b / AC4
 *
 * 造数：`seedLegacyCipher` 复刻旧实现产出「真密文」，使迁移走真解密路径。
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

const makeProjectRecord = async (
    id: string,
    userId: string,
    encrypt: (plain: string) => Promise<string>
): Promise<ProjectRecord> => ({
    id,
    userId,
    name: await encrypt('项目'),
    icon: 'more2',
    description: await encrypt('项目描述'),
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    deletedAt: null,
    archivedAt: null,
    deactivedAt: null,
    sortId: 1,
    taskCount: 0
})

const makeTagRecord = async (
    id: string,
    userId: string,
    encrypt: (plain: string) => Promise<string>
): Promise<TagRecord> => ({
    id,
    userId,
    icon: 'tag',
    name: await encrypt('标签'),
    description: await encrypt('标签描述'),
    color: '#fff',
    sortId: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    deletedAt: null
})

describe('明文迁移器（AC2 / AC3a / AC3b / AC4）', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('AC2：存量密文库 ⇒ 全库解包 + 写完成标记；key-bundle 未删；不产生脏队列（C-48）', async () => {
        const legacy = await seedLegacyCipher(USER_ID, PASSWORD)
        await localDatabase.tasks.put(await makeTaskRecord('t-1', USER_ID, legacy.encrypt))
        await localDatabase.projects.put(await makeProjectRecord('p-1', USER_ID, legacy.encrypt))
        await localDatabase.tags.put(await makeTagRecord('g-1', USER_ID, legacy.encrypt))
        await cryptoService.unlock(USER_ID, PASSWORD)

        expect(await isPlaintextMigrationDone(USER_ID)).toBe(false)
        const result = await runPlaintextMigration(USER_ID)

        expect(result.ran).toBe(true)
        expect(result.migrated).toBe(3)
        expect(await isPlaintextMigrationDone(USER_ID)).toBe(true)

        const task = (await localDatabase.tasks.get('t-1'))!
        expect(task.name).toBe('plain:任务')
        expect(task.description).toBe('plain:描述')
        // 读边界（recordToEntity）无异常且语义不变
        const entity = await taskRecordToEntity(task)
        expect(entity.name).toBe('任务')
        expect(entity.description).toBe('描述')
        const project = (await localDatabase.projects.get('p-1'))!
        expect(project.name).toBe('plain:项目')
        expect((await projectRecordToEntity(project)).description).toBe('项目描述')
        expect((await localDatabase.tags.get('g-1'))!.name).toBe('plain:标签')

        // C-48：迁移直写表，不 markDirty
        expect(await localDatabase.syncQueue.count()).toBe(0)
        // C-51：key-bundle 不删（唯一不可逆开关，本单不删）
        expect(await localDatabase.meta.get(`${USER_ID}:key-bundle`)).toBeDefined()
    })

    it('AC3a/AC3b：混合格式（部分 plain / 部分密文）可读取，且续跑完成（幂等）', async () => {
        const legacy = await seedLegacyCipher(USER_ID, PASSWORD)
        // 模拟「迁移中途被杀」后的混合库：t-1 已迁移（plain:），t-2 仍为密文
        const migrated = await makeTaskRecord('t-1', USER_ID, legacy.encrypt)
        migrated.name = 'plain:任务'
        migrated.description = 'plain:描述'
        await localDatabase.tasks.put(migrated)
        await localDatabase.tasks.put(await makeTaskRecord('t-2', USER_ID, legacy.encrypt))
        // 混合格式（同一记录内部分字段已明文）也不得导致整库读失败（C-51）
        const partial = await makeTaskRecord('t-3', USER_ID, legacy.encrypt)
        partial.description = 'plain:描述'
        await localDatabase.tasks.put(partial)
        await cryptoService.unlock(USER_ID, PASSWORD)

        // 混合格式可正常读取
        expect((await taskRecordToEntity((await localDatabase.tasks.get('t-1'))!)).name).toBe(
            '任务'
        )
        expect((await taskRecordToEntity((await localDatabase.tasks.get('t-2'))!)).name).toBe(
            '任务'
        )

        const result = await runPlaintextMigration(USER_ID)
        expect(result.migrated).toBe(2) // t-1 已迁移跳过；t-2/t-3 迁移
        for (const id of ['t-1', 't-2', 't-3']) {
            const record = (await localDatabase.tasks.get(id))!
            expect(record.name.startsWith('plain:')).toBe(true)
            expect(record.description.startsWith('plain:')).toBe(true)
        }

        // 幂等：第二次运行短路，不再迁移
        const second = await runPlaintextMigration(USER_ID)
        expect(second.ran).toBe(false)
        expect(second.migrated).toBe(0)
    })

    it('迁移按 userId 过滤：他人记录零触碰', async () => {
        const legacy = await seedLegacyCipher(USER_ID, PASSWORD)
        await localDatabase.tasks.put(await makeTaskRecord('t-mine', USER_ID, legacy.encrypt))
        const other = await makeTaskRecord('t-other', 'u-2', legacy.encrypt)
        await localDatabase.tasks.put(other)
        await cryptoService.unlock(USER_ID, PASSWORD)

        await runPlaintextMigration(USER_ID)

        expect((await localDatabase.tasks.get('t-mine'))!.name.startsWith('plain:')).toBe(true)
        expect((await localDatabase.tasks.get('t-other'))!.name).toBe(other.name)
        expect(await localDatabase.meta.get(plaintextMigrationMarkerId('u-2'))).toBeUndefined()
    })

    it('AC4：跳过迁移 ⇒ 完成标记未写、key-bundle 保留（本单不删）', async () => {
        const legacy = await seedLegacyCipher(USER_ID, PASSWORD)
        await localDatabase.tasks.put(await makeTaskRecord('t-1', USER_ID, legacy.encrypt))
        // 「跳过」= 不调用 runPlaintextMigration
        expect(await isPlaintextMigrationDone(USER_ID)).toBe(false)
        expect(await localDatabase.meta.get(`${USER_ID}:key-bundle`)).toBeDefined()
        expect((await localDatabase.tasks.get('t-1'))!.name.startsWith('plain:')).toBe(false)
    })

    it('多实例选主（navigator.locks 被占用）⇒ 跳过迁移，不并发写同一批记录', async () => {
        const legacy = await seedLegacyCipher(USER_ID, PASSWORD)
        await localDatabase.tasks.put(await makeTaskRecord('t-1', USER_ID, legacy.encrypt))
        await cryptoService.unlock(USER_ID, PASSWORD)
        vi.stubGlobal('navigator', {
            locks: {
                request: async (
                    _name: string,
                    _options: unknown,
                    callback: (lock: unknown) => Promise<void>
                ): Promise<void> => callback(null)
            }
        })
        try {
            const result = await runPlaintextMigration(USER_ID)
            expect(result.lockSkipped).toBe(true)
            expect(result.ran).toBe(false)
            expect(await isPlaintextMigrationDone(USER_ID)).toBe(false)
            expect((await localDatabase.tasks.get('t-1'))!.name.startsWith('plain:')).toBe(false)
        } finally {
            vi.unstubAllGlobals()
        }
    })
})