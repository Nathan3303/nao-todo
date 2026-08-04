import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateProjectValueObject, UpdateProjectValueObject } from '@nao-todo/domain-project'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../crypto/crypto-service'
import { localDatabase } from '../db/local-database'
import { LocalProjectRepoImpl } from '../repos/project-repo-impl'
import { LocalTaskRepoImpl } from '../repos/task-repo-impl'

/**
 * 重置本地数据库并解锁密钥
 */
const setup = async () => {
    await Promise.all([
        localDatabase.projects.clear(),
        localDatabase.tasks.clear(),
        localDatabase.meta.clear()
    ])
    cryptoService.lock()
    await cryptoService.setup('test-password')
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
})