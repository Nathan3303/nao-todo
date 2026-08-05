import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateProjectValueObject, UpdateProjectValueObject } from '@nao-todo/domain-project'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../crypto/crypto-service'
import { localDatabase } from '../db/local-database'
import { localSession } from '../session/local-session'
import { LocalProjectRepoImpl } from '../repos/project-repo-impl'
import { LocalProjectPreferenceRepoImpl } from '../repos/project-preference-repo-impl'
import { LocalTagPreferenceRepoImpl } from '../repos/tag-preference-repo-impl'
import { LocalTaskRepoImpl } from '../repos/task-repo-impl'

/**
 * 重置本地数据库并解锁密钥
 */
const setup = async (userId = 'test-user') => {
    await Promise.all([
        localDatabase.projects.clear(),
        localDatabase.tasks.clear(),
        localDatabase.meta.clear()
    ])
    cryptoService.lock()
    localSession.setCurrentUserId(userId)
    await cryptoService.setup(userId, 'test-password')
}

/**
 * 切换当前用户（保留库内既有数据，仅更换会话与密钥）
 * @description 已有密钥包则用密码 unlock 还原原 DEK，没有则首次 setup
 */
const switchUser = async (userId: string) => {
    cryptoService.lock()
    localSession.setCurrentUserId(userId)
    await cryptoService.ensureUnlocked(userId, 'test-password')
}

const makeTaskVO = (overrides: Partial<CreateTaskValueObject> = {}): CreateTaskValueObject =>
    new CreateTaskValueObject(
        null,
        overrides.parentTaskId ?? null,
        overrides.name ?? '测试任务',
        overrides.description ?? '',
        overrides.state ?? 'todo',
        overrides.priority ?? 'medium',
        overrides.startAt ?? null,
        overrides.endAt ?? null,
        overrides.projectId ?? 'project-1',
        overrides.tags ?? [],
        overrides.remindAt ?? null,
        overrides.remindRepeat ?? 'none',
        overrides.remindTime ?? null,
        overrides.remindWeekdays ?? []
    )

describe('LocalProjectRepoImpl', () => {
    beforeEach(async () => {
        await setup()
    })

    it('create → get 往返，明文一致', async () => {
        const repo = new LocalProjectRepoImpl()
        const [created, err] = await repo.create(
            new CreateProjectValueObject('工作项目', 'more2', '工作相关的任务')
        )
        expect(err).toBeNull()
        expect(created).not.toBeNull()

        const [fetched, fetchErr] = await repo.get(created!.id)
        expect(fetchErr).toBeNull()
        expect(fetched!.name).toBe('工作项目')
        expect(fetched!.description).toBe('工作相关的任务')
    })

    it('落库记录中敏感字段为密文（不含明文）', async () => {
        const repo = new LocalProjectRepoImpl()
        const [created] = await repo.create(
            new CreateProjectValueObject('机密项目', 'more2', '绝密描述')
        )
        const record = await localDatabase.projects.get(created!.id)
        expect(record!.name).not.toContain('机密项目')
        expect(record!.description).not.toContain('绝密描述')
    })

    it('update / archive / restore / delete 语义正确', async () => {
        const repo = new LocalProjectRepoImpl()
        const [created] = await repo.create(new CreateProjectValueObject('项目A', 'more2', ''))

        const updateVO = new UpdateProjectValueObject(created!.id)
        updateVO.name = '项目A改'
        expect(await repo.update(updateVO)).toBeNull()
        const [afterUpdate] = await repo.get(created!.id)
        expect(afterUpdate!.name).toBe('项目A改')

        expect(await repo.archive(created!.id)).toBeNull()
        const [afterArchive] = await repo.get(created!.id)
        expect(afterArchive!.archivedAt).not.toBeNull()

        expect(await repo.unarchive(created!.id)).toBeNull()
        const [afterUnarchive] = await repo.get(created!.id)
        expect(afterUnarchive!.archivedAt).toBeNull()

        expect(await repo.delete(created!.id)).toBeNull()
        const [afterDelete] = await repo.get(created!.id)
        expect(afterDelete!.deletedAt).not.toBeNull()

        expect(await repo.restore(created!.id)).toBeNull()
        const [afterRestore] = await repo.get(created!.id)
        expect(afterRestore!.deletedAt).toBeNull()
    })

    it('不存在的项目返回错误', async () => {
        const repo = new LocalProjectRepoImpl()
        const [entity, err] = await repo.get('not-exist')
        expect(entity).toBeNull()
        expect(err).not.toBeNull()
    })
})

describe('LocalTaskRepoImpl', () => {
    beforeEach(async () => {
        await setup()
    })

    it('create → list 往返，内容字段加密存储', async () => {
        const repo = new LocalTaskRepoImpl()
        const [created, err] = await repo.create(makeTaskVO({ name: '买牛奶' }))
        expect(err).toBeNull()

        const record = await localDatabase.tasks.get(created!.id)
        expect(record!.name).not.toContain('买牛奶')

        const [listResult] = await repo.list('isDeleted=false')
        expect(listResult!.taskEntities).toHaveLength(1)
        expect(listResult!.taskEntities[0]!.name).toBe('买牛奶')
    })

    it('isDeleted 过滤：软删除的任务不出现在 isDeleted=false', async () => {
        const repo = new LocalTaskRepoImpl()
        await repo.create(makeTaskVO({ name: '任务1' }))
        const [, err] = await repo.create(makeTaskVO({ name: '任务2' }))
        expect(err).toBeNull()
        // 软删一条
        const [all] = await repo.list('isDeleted=false')
        await repo.remove(all!.taskEntities[0]!.id)

        const [active] = await repo.list('isDeleted=false')
        expect(active!.taskEntities).toHaveLength(1)
        const [deleted] = await repo.list('isDeleted=true')
        expect(deleted!.taskEntities).toHaveLength(1)
    })

    it('state / projectId / tagId 过滤与分页', async () => {
        const repo = new LocalTaskRepoImpl()
        await repo.create(makeTaskVO({ name: '待办A', state: 'todo', projectId: 'p1' }))
        await repo.create(makeTaskVO({ name: '待办B', state: 'todo', projectId: 'p1' }))
        await repo.create(makeTaskVO({ name: '完成C', state: 'done', projectId: 'p2' }))
        await repo.create(
            makeTaskVO({ name: '标签D', state: 'todo', projectId: 'p1', tags: ['t1'] })
        )

        const [byState] = await repo.list('state=todo')
        expect(byState!.taskEntities).toHaveLength(3)

        const [byProject] = await repo.list('state=todo&projectId=p1')
        expect(byProject!.taskEntities).toHaveLength(3)

        const [byTag] = await repo.list('tagId=t1')
        expect(byTag!.taskEntities).toHaveLength(1)
        expect(byTag!.taskEntities[0]!.name).toBe('标签D')

        const [paged] = await repo.list('state=todo&page=1&limit=2')
        expect(paged!.taskEntities).toHaveLength(2)
        expect(paged!.pagination).toMatchObject({ total: 3, page: 1, limit: 2, maxPage: 2 })
    })

    it('name 内容过滤（解密后）', async () => {
        const repo = new LocalTaskRepoImpl()
        await repo.create(makeTaskVO({ name: '买牛奶和面包' }))
        await repo.create(makeTaskVO({ name: '写周报' }))

        const [matched] = await repo.list('name=牛奶')
        expect(matched!.taskEntities).toHaveLength(1)
        expect(matched!.taskEntities[0]!.name).toBe('买牛奶和面包')
    })

    it('snooze 更新 remindAt 并返回新时间', async () => {
        const repo = new LocalTaskRepoImpl()
        const [created] = await repo.create(makeTaskVO({ remindAt: '2024-01-01T00:00:00.000Z' }))
        const [newRemindAt, err] = await repo.snooze(created!.id, 30)
        expect(err).toBeNull()
        expect(newRemindAt).not.toBeNull()
        const [after] = await repo.get(created!.id)
        expect(after!.remindAt).toBe(newRemindAt)
    })

    it('copy 生成新任务', async () => {
        const repo = new LocalTaskRepoImpl()
        const [created] = await repo.create(makeTaskVO({ name: '原任务' }))
        const [copied, err] = await repo.copy(created!.id)
        expect(err).toBeNull()
        expect(copied!.id).not.toBe(created!.id)
        expect(copied!.name).toBe('原任务')
        const [all] = await repo.list('isDeleted=false')
        expect(all!.taskEntities).toHaveLength(2)
    })

    it('Proxy（reactive）数组创建任务不抛 DataCloneError，入库为普通数组', async () => {
        const repo = new LocalTaskRepoImpl()
        // 模拟 Vue reactive 包装的数组（IndexedDB 结构化克隆无法克隆 Proxy）
        const reactiveTags = new Proxy(['tag-1'], {}) as string[]
        const reactiveWeekdays = new Proxy([1, 3], {}) as number[]

        const [created, err] = await repo.create(
            makeTaskVO({
                name: '代理数组任务',
                tags: reactiveTags,
                remindWeekdays: reactiveWeekdays
            })
        )
        expect(err).toBeNull()
        expect(created).not.toBeNull()

        // 入库记录为普通数组，且不引用传入的 Proxy
        const record = await localDatabase.tasks.get(created!.id)
        expect(record!.tags).toEqual(['tag-1'])
        expect(record!.tags).not.toBe(reactiveTags)
        expect(record!.remindWeekdays).toEqual([1, 3])
        expect(record!.remindWeekdays).not.toBe(reactiveWeekdays)
    })
})

describe('偏好默认值', () => {
    beforeEach(async () => {
        await setup()
    })

    it('项目偏好不存在时返回默认偏好（不报错）', async () => {
        const repo = new LocalProjectPreferenceRepoImpl()
        const [pref, err] = await repo.getByProjectId('project-x')
        expect(err).toBeNull()
        expect(pref!.projectId).toBe('project-x')
        expect(pref!.viewType).toBe('table')
    })

    it('保存后按 projectId 取回已存偏好', async () => {
        const repo = new LocalProjectPreferenceRepoImpl()
        const [defaultPref] = await repo.getByProjectId('project-y')
        await repo.save(defaultPref!)

        const [saved, err] = await repo.getByProjectId('project-y')
        expect(err).toBeNull()
        expect(saved!.projectId).toBe('project-y')
    })

    it('标签偏好不存在时返回默认偏好（不报错），参数按 tagId 查询', async () => {
        const repo = new LocalTagPreferenceRepoImpl()
        const [pref, err] = await repo.get('tag-1')
        expect(err).toBeNull()
        expect(pref!.viewType).toBe('table')
    })
})

describe('多用户数据隔离', () => {
    beforeEach(async () => {
        await setup('user-1')
    })

    it('不同用户的 project/task 数据互不可见', async () => {
        const repo = new LocalProjectRepoImpl()
        const [project] = await repo.create(
            new CreateProjectValueObject('user-1 的项目', 'more2', '')
        )
        expect(project).not.toBeNull()
        await new LocalTaskRepoImpl().create(
            makeTaskVO({ name: 'user-1 的任务', projectId: project!.id })
        )

        // 切到 user-2（沿用同一库，不清数据），应看不到 user-1 的数据
        await switchUser('user-2')

        const [projectList] = await repo.list()
        expect(projectList).toHaveLength(0)
        const [taskList] = await new LocalTaskRepoImpl().list('isDeleted=false')
        expect(taskList!.taskEntities).toHaveLength(0)

        // 跨用户按 id 直接 get 也应返回不存在
        const [entity, err] = await repo.get(project!.id)
        expect(entity).toBeNull()
        expect(err).not.toBeNull()
    })

    it('切回 user-1 数据仍在', async () => {
        const repo = new LocalProjectRepoImpl()
        const [project] = await repo.create(
            new CreateProjectValueObject('user-1 的项目', 'more2', '')
        )
        const projectId = project!.id

        await switchUser('user-2')
        await switchUser('user-1')

        const [fetched, err] = await repo.get(projectId)
        expect(err).toBeNull()
        expect(fetched!.name).toBe('user-1 的项目')
    })
})