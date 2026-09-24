import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateProjectValueObject, UpdateProjectValueObject } from '@nao-todo/domain-project'
import { localDatabase } from '../db/local-database'
import { LocalProjectPreferenceRepoImpl } from '../repos/project-preference-repo-impl'
import { LocalProjectRepoImpl } from '../repos/project-repo-impl'
import { LocalTagPreferenceRepoImpl } from '../repos/tag-preference-repo-impl'
import { LocalTaskRepoImpl } from '../repos/task-repo-impl'
import { makeTaskVO, setup, switchUser } from './local-repos-test-helpers'

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

    it('落库记录中敏感字段为明文自描述格式（`plain:` 前缀，C-46）', async () => {
        const repo = new LocalProjectRepoImpl()
        const [created] = await repo.create(
            new CreateProjectValueObject('机密项目', 'more2', '绝密描述')
        )
        const record = await localDatabase.projects.get(created!.id)
        expect(record!.name).toBe('plain:机密项目')
        expect(record!.description).toBe('plain:绝密描述')
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

describe('LocalProjectRepoImpl 软删过滤', () => {
    beforeEach(async () => {
        await setup()
    })

    const createProject = async (repo: LocalProjectRepoImpl, name: string) => {
        const [entity, err] = await repo.create(new CreateProjectValueObject(name, 'more2', ''))
        expect(err).toBeNull()
        return entity!
    }

    it('软删（repo.delete）后 list 不再返回该项，墓碑仍在库中', async () => {
        const repo = new LocalProjectRepoImpl()
        const project = await createProject(repo, '待删项目')

        expect(await repo.delete(project.id)).toBeNull()

        // 软删语义：记录保留（deletedAt 置位），仅查询过滤
        const tombstone = await localDatabase.projects.get(project.id)
        expect(tombstone?.deletedAt).not.toBeNull()

        const [listResult, err] = await repo.list()
        expect(err).toBeNull()
        expect(listResult).toEqual([])
    })

    it('deletedAt 为空串（远端同步拉取的未删记录）视为未删除，list 返回', async () => {
        const repo = new LocalProjectRepoImpl()
        const project = await createProject(repo, '远端未删项目')

        // 模拟远程同步写入：后端空串表示未删（见 isNotDeleted 语义）
        const record = await localDatabase.projects.get(project.id)
        record!.deletedAt = ''
        await localDatabase.projects.put(record!)

        const [listResult, err] = await repo.list()
        expect(err).toBeNull()
        expect(listResult!.map((p) => p.id)).toEqual([project.id])
    })

    it('混合场景：已删项被过滤，未删项保留', async () => {
        const repo = new LocalProjectRepoImpl()
        const a = await createProject(repo, '保留项目A')
        const b = await createProject(repo, '删除项目B')
        const c = await createProject(repo, '保留项目C')

        await repo.delete(b.id)

        const [listResult, err] = await repo.list()
        expect(err).toBeNull()
        expect(listResult!.map((p) => p.id)).toEqual([a.id, c.id])
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
        // 默认偏好 id 为空串：save 须自动生成稳定主键（否则 Dexie put 报 DataError）
        expect(defaultPref!.id).toBe('')
        const saveErr = await repo.save(defaultPref!)
        expect(saveErr).toBeNull()

        const [saved, err] = await repo.getByProjectId('project-y')
        expect(err).toBeNull()
        expect(saved!.projectId).toBe('project-y')

        // 修改后再次 save：覆盖同一条（不新增）
        saved!.viewType = 'kanban'
        expect(await repo.save(saved!)).toBeNull()
        const records = await localDatabase.projectPreferences.toArray()
        expect(records.length).toBe(1)
        expect(records[0]!.id).toBe(`test-user:project-y`)
        const [after] = await repo.getByProjectId('project-y')
        expect(after!.viewType).toBe('kanban')
    })

    it('标签偏好默认 id 为空串时 save 不报错并生成稳定主键', async () => {
        const repo = new LocalTagPreferenceRepoImpl()
        const [defaultPref] = await repo.get('tag-9')
        expect(defaultPref!.id).toBe('')
        expect(await repo.save(defaultPref!)).toBeNull()
        const records = await localDatabase.tagPreferences.toArray()
        expect(records.length).toBe(1)
        expect(records[0]!.id).toBe(`test-user:tag-9`)
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