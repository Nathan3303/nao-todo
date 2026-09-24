import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateProjectValueObject } from '@nao-todo/domain-project'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { localDatabase } from '../db/local-database'
import { MissingUserIdError, localSession } from '../session/local-session'
import { LocalProjectRepoImpl } from '../repos/project-repo-impl'
import { LocalProjectPreferenceRepoImpl } from '../repos/project-preference-repo-impl'
import { LocalTagRepoImpl } from '../repos/tag-repo-impl'
import { LocalTagPreferenceRepoImpl } from '../repos/tag-preference-repo-impl'
import { LocalTaskRepoImpl } from '../repos/task-repo-impl'
import { LocalTaskCheckItemRepoImpl } from '../repos/task-check-item-repo-impl'
import { LocalTaskCommentRepoImpl } from '../repos/task-comment-repo-impl'
import { LocalPomodoroRepoImpl } from '../repos/pomodoro-repo-impl'
import { LocalPomodoroRecordRepoImpl } from '../repos/pomodoro-record-repo-impl'
import { LocalUserRepoImpl } from '../repos/user-repo-impl'
import { LocalUserConfigRepoImpl } from '../repos/user-config-repo-impl'

/**
 * AC11 / C-55 `userId` 硬失败回归
 *
 * @description 原实现 `localSession.getCurrentUserId() ?? ''` 会在无会话时退化为
 *              「空用户」读写（明文姿态下可跨用户读到明文）⇒ 必须硬失败。
 *              硬失败**单源化**在 `localSession.requireCurrentUserId()`；11 个本地仓储
 *              的 `currentUserId` getter 均委托它（无第二套判断），故此处对全部仓储断言
 *              「无会话 ⇒ 库操作一律被拒绝」（任一仓储漏改 ⇒ 本文件转红）。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-55）
 * @see docs/prds/2026-09-23-web-offline-stage1.md（AC11）
 */

const clearTables = async () => {
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
}

/** GoAsync<void> 直接返回 GoError；其余返回 [value, error] ⇒ 统一取出错误位 */
const takeError = (result: unknown): unknown => (Array.isArray(result) ? result[1] : result)

const makeTaskVO = (): CreateTaskValueObject =>
    new CreateTaskValueObject(
        null,
        null,
        'T',
        '',
        'todo',
        'medium',
        null,
        null,
        'project-1',
        [],
        null,
        'none',
        null,
        []
    )

/**
 * 全部本地仓储的库操作（读 + 写各取代表）——无会话时**每一项都必须被拒绝**
 */
const operations: Array<{ name: string; run: () => Promise<unknown> }> = [
    { name: 'projects.get', run: () => new LocalProjectRepoImpl().get('missing') },
    { name: 'projects.list', run: () => new LocalProjectRepoImpl().list() },
    {
        name: 'projects.create',
        run: () => new LocalProjectRepoImpl().create(new CreateProjectValueObject('x', 'more2', ''))
    },
    {
        name: 'projectPreferences.getByProjectId',
        run: () => new LocalProjectPreferenceRepoImpl().getByProjectId('missing')
    },
    { name: 'tags.getById', run: () => new LocalTagRepoImpl().getById('missing') },
    { name: 'tags.list', run: () => new LocalTagRepoImpl().list() },
    { name: 'tags.getByIds', run: () => new LocalTagRepoImpl().getByIds(['missing']) },
    { name: 'tagPreferences.get', run: () => new LocalTagPreferenceRepoImpl().get('missing') },
    { name: 'tasks.get', run: () => new LocalTaskRepoImpl().get('missing') },
    { name: 'tasks.list', run: () => new LocalTaskRepoImpl().list() },
    { name: 'tasks.create', run: () => new LocalTaskRepoImpl().create(makeTaskVO()) },
    { name: 'taskCheckItems.list', run: () => new LocalTaskCheckItemRepoImpl().list('missing') },
    { name: 'taskComments.list', run: () => new LocalTaskCommentRepoImpl().list('missing') },
    { name: 'pomodoros.get', run: () => new LocalPomodoroRepoImpl().get('missing') },
    { name: 'pomodoros.list', run: () => new LocalPomodoroRepoImpl().list() },
    { name: 'pomodoroRecords.get', run: () => new LocalPomodoroRecordRepoImpl().get('missing') },
    { name: 'pomodoroRecords.list', run: () => new LocalPomodoroRecordRepoImpl().list() },
    { name: 'userConfigs.get', run: () => new LocalUserConfigRepoImpl().get() },
    { name: 'users.getProfile', run: () => new LocalUserRepoImpl().getProfile() }
]

describe('AC11 userId 硬失败（C-55）', () => {
    beforeEach(async () => {
        await clearTables()
        localSession.clear()
    })

    it('requireCurrentUserId：null / 空串 ⇒ 抛 MissingUserIdError；有值 ⇒ 返回该值', () => {
        expect(() => localSession.requireCurrentUserId()).toThrow(MissingUserIdError)

        localSession.setCurrentUserId('')
        expect(() => localSession.requireCurrentUserId()).toThrow(MissingUserIdError)

        localSession.setCurrentUserId('u-1')
        expect(localSession.requireCurrentUserId()).toBe('u-1')
        // 可空口径保留（供 sync-tracker / C-62 判空使用），但不参与库操作
        expect(localSession.getCurrentUserId()).toBe('u-1')
    })

    it('无会话：一切库操作被拒绝（不再有 ?? 空串兜底的成功路径）', async () => {
        for (const op of operations) {
            const error = takeError(await op.run())
            expect(error, `${op.name} 应被拒绝`).not.toBeNull()
        }
    })

    it('无会话 + 记录存在：读路径硬失败且错误可见（非 ?? 空串匹配）', async () => {
        // 先用有效会话造一条记录，再清空会话（记录仍在库中）
        localSession.setCurrentUserId('user-a')
        const [created] = await new LocalProjectRepoImpl().create(
            new CreateProjectValueObject('A 的项目', 'more2', '')
        )
        expect(created).not.toBeNull()
        const [task] = await new LocalTaskRepoImpl().create(makeTaskVO())
        expect(task).not.toBeNull()

        localSession.clear()

        // 记录存在 ⇒ 必达 userId 比较 ⇒ 抛 MissingUserIdError（经 GoAsync 错误通道可见）
        const [, projectErr] = await new LocalProjectRepoImpl().get(created!.id)
        expect(String(projectErr)).toContain('userId')

        const [, taskErr] = await new LocalTaskRepoImpl().get(task!.id)
        expect(String(taskErr)).toContain('userId')

        const [, listErr] = await new LocalTaskRepoImpl().list()
        expect(String(listErr)).toContain('userId')
    })

    it('无会话时写操作不落任何记录（不产生 userId="" 的空用户数据）', async () => {
        const [created] = await new LocalProjectRepoImpl().create(
            new CreateProjectValueObject('越权项目', 'more2', '')
        )
        expect(created).toBeNull()
        expect(await localDatabase.projects.count()).toBe(0)
        expect(await localDatabase.projects.where('userId').equals('').count()).toBe(0)
    })

    it('跨账号不串数据：A 的数据对 B 不可见（且 A 记录未被误删/改写）', async () => {
        localSession.setCurrentUserId('user-a')
        const repo = new LocalProjectRepoImpl()
        const [createdA] = await repo.create(new CreateProjectValueObject('A 的项目', 'more2', ''))
        expect(createdA).not.toBeNull()

        // 切换到 B（模拟同设备另一账号：内存会话更换，不触发清库）
        localSession.setCurrentUserId('user-b')
        const repoB = new LocalProjectRepoImpl()

        const [gotByB, errByB] = await repoB.get(createdA!.id)
        expect(gotByB).toBeNull()
        expect(errByB).not.toBeNull()

        const [listB] = await repoB.list()
        expect(listB).toEqual([])

        // A 的记录仍在库中且归属 A（未被 B 误清/改写）
        const recordA = await localDatabase.projects.get(createdA!.id)
        expect(recordA?.userId).toBe('user-a')
        expect(await localDatabase.projects.where('userId').equals('user-a').count()).toBe(1)
    })
})