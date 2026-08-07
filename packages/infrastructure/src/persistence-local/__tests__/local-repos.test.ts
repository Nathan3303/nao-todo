import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import dayjs from 'dayjs'
import { CreateProjectValueObject, UpdateProjectValueObject } from '@nao-todo/domain-project'
import { TagEntity } from '@nao-todo/domain-tag'
import {
    CreatePomodoroRecordValueObject,
    CreatePomodoroValueObject
} from '@nao-todo/domain-pomodoro'
import {
    CreateTaskCheckItemValueObject,
    CreateTaskValueObject,
    UpdateTaskValueObject
} from '@nao-todo/domain-task'
import { cryptoService } from '../crypto/crypto-service'
import { localDatabase } from '../db/local-database'
import { localSession } from '../session/local-session'
import { LocalProjectRepoImpl } from '../repos/project-repo-impl'
import { LocalProjectPreferenceRepoImpl } from '../repos/project-preference-repo-impl'
import { LocalPomodoroRecordRepoImpl } from '../repos/pomodoro-record-repo-impl'
import { LocalPomodoroRepoImpl } from '../repos/pomodoro-repo-impl'
import { LocalTagPreferenceRepoImpl } from '../repos/tag-preference-repo-impl'
import { LocalTagRepoImpl } from '../repos/tag-repo-impl'
import { LocalTaskCheckItemRepoImpl } from '../repos/task-check-item-repo-impl'
import { LocalTaskRepoImpl } from '../repos/task-repo-impl'

/**
 * 重置本地数据库并解锁密钥
 */
const setup = async (userId = 'test-user') => {
    // 串行清空，避免 fake-indexeddb 下并行事务竞态导致 clear 丢失
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

    it('state 逗号分隔多值查询（todo,in-progress）返回对应状态任务', async () => {
        const repo = new LocalTaskRepoImpl()
        await repo.create(makeTaskVO({ name: '待办', state: 'todo' }))
        await repo.create(makeTaskVO({ name: '进行中', state: 'in-progress' }))
        await repo.create(makeTaskVO({ name: '已完成', state: 'done' }))

        const [result, err] = await repo.list('isDeleted=false&state=todo,in-progress')
        expect(err).toBeNull()
        expect(result!.taskEntities.map((t) => t.name).sort()).toEqual(['待办', '进行中'])
    })

    it('relativeDate=-overdue 下未来截止与无截止时间任务保留，已逾期排除', async () => {
        const repo = new LocalTaskRepoImpl()
        await repo.create(makeTaskVO({ name: '无截止时间', endAt: null }))
        await repo.create(
            makeTaskVO({ name: '已逾期', endAt: dayjs().subtract(1, 'day').toISOString() })
        )
        await repo.create(
            makeTaskVO({ name: '未来截止', endAt: dayjs().add(1, 'day').toISOString() })
        )

        const [result, err] = await repo.list('isDeleted=false&relativeDate=-overdue')
        expect(err).toBeNull()
        expect(result!.taskEntities.map((t) => t.name).sort()).toEqual(['无截止时间', '未来截止'])
    })

    it('未传 parentTaskId 时默认只返回顶层任务（子任务排除）', async () => {
        const repo = new LocalTaskRepoImpl()
        const [parent] = await repo.create(makeTaskVO({ name: '顶层任务' }))
        await repo.create(makeTaskVO({ name: '子任务一', parentTaskId: parent!.id }))
        await repo.create(makeTaskVO({ name: '子任务二', parentTaskId: parent!.id }))

        const [result, err] = await repo.list('isDeleted=false')
        expect(err).toBeNull()
        expect(result!.taskEntities.map((t) => t.name)).toEqual(['顶层任务'])
    })

    it('传 parentTaskId 时只返回对应子任务', async () => {
        const repo = new LocalTaskRepoImpl()
        const [parent] = await repo.create(makeTaskVO({ name: '顶层任务' }))
        await repo.create(makeTaskVO({ name: '子任务一', parentTaskId: parent!.id }))
        await repo.create(makeTaskVO({ name: '子任务二', parentTaskId: parent!.id }))

        const [result, err] = await repo.list(
            `isDeleted=false&parentTaskId=${encodeURIComponent(parent!.id)}`
        )
        expect(err).toBeNull()
        expect(result!.taskEntities.map((t) => t.name).sort()).toEqual(['子任务一', '子任务二'])
    })

    it('默认（未传 isGivenUp）不查询已放弃任务', async () => {
        const repo = new LocalTaskRepoImpl()
        const [task] = await repo.create(makeTaskVO({ name: '正常任务' }))
        // 放弃任务
        const updateVO = new UpdateTaskValueObject(task!.id)
        updateVO.givenUpAt = new Date().toISOString()
        await repo.update(task!.id, updateVO)

        const [result, err] = await repo.list('isDeleted=false')
        expect(err).toBeNull()
        expect(result!.taskEntities).toHaveLength(0)
    })

    it('isGivenUp=false 不查询已放弃任务，isGivenUp=true 只查询已放弃', async () => {
        const repo = new LocalTaskRepoImpl()
        const [normal] = await repo.create(makeTaskVO({ name: '正常任务' }))
        const [givenUp] = await repo.create(makeTaskVO({ name: '已放弃' }))
        const updateVO = new UpdateTaskValueObject(givenUp!.id)
        updateVO.givenUpAt = new Date().toISOString()
        await repo.update(givenUp!.id, updateVO)

        const [normalList] = await repo.list('isDeleted=false&isGivenUp=false')
        expect(normalList!.taskEntities.map((t) => t.name)).toEqual(['正常任务'])
        expect(normal!.id).toBeTruthy()

        const [givenUpList] = await repo.list('isDeleted=false&isGivenUp=true')
        expect(givenUpList!.taskEntities.map((t) => t.name)).toEqual(['已放弃'])
    })

    it('priority 逗号分隔多值查询（high,urgent）返回对应优先级任务', async () => {
        const repo = new LocalTaskRepoImpl()
        await repo.create(makeTaskVO({ name: '高优先级', priority: 'high' }))
        await repo.create(makeTaskVO({ name: '紧急', priority: 'urgent' }))
        await repo.create(makeTaskVO({ name: '中优先级', priority: 'medium' }))

        const [result, err] = await repo.list('isDeleted=false&priority=high,urgent')
        expect(err).toBeNull()
        expect(result!.taskEntities.map((t) => t.name).sort()).toEqual(['紧急', '高优先级'])
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

describe('TaskCheckItem 排序', () => {
    beforeEach(async () => {
        await setup('user-1')
    })

    const createItem = async (repo: LocalTaskCheckItemRepoImpl, taskId: string, name: string) => {
        const [entity, err] = await repo.create(
            new CreateTaskCheckItemValueObject(taskId, name, false, false)
        )
        expect(err).toBeNull()
        return entity!
    }

    it('同一任务连续创建：sortId 依次递增且 list 顺序正确', async () => {
        const repo = new LocalTaskCheckItemRepoImpl()
        const first = await createItem(repo, 'task-1', '第一项')
        const second = await createItem(repo, 'task-1', '第二项')
        const third = await createItem(repo, 'task-1', '第三项')

        expect(first.sortId).toBe(1)
        expect(second.sortId).toBe(2)
        expect(third.sortId).toBe(3)

        const [listResult, err] = await repo.list('task-1')
        expect(err).toBeNull()
        expect(listResult!.map((item) => item.sortId)).toEqual([1, 2, 3])
        expect(listResult!.map((item) => item.name)).toEqual(['第一项', '第二项', '第三项'])
    })

    it('不同 taskId 各自独立计数', async () => {
        const repo = new LocalTaskCheckItemRepoImpl()
        await createItem(repo, 'task-a', 'A1')
        await createItem(repo, 'task-a', 'A2')
        const b1 = await createItem(repo, 'task-b', 'B1')

        expect(b1.sortId).toBe(1)
    })

    it('跨用户隔离：user-2 创建不影响 user-1 的 max 计算', async () => {
        const repo = new LocalTaskCheckItemRepoImpl()
        await createItem(repo, 'task-1', 'user-1 第一项')
        await createItem(repo, 'task-1', 'user-1 第二项')

        // 切到 user-2 在同一任务下创建
        await switchUser('user-2')
        const u2 = await createItem(repo, 'task-1', 'user-2 项')
        expect(u2.sortId).toBe(1)

        // 切回 user-1 继续创建，sortId 接续原最大值
        await switchUser('user-1')
        const u1Third = await createItem(repo, 'task-1', 'user-1 第三项')
        expect(u1Third.sortId).toBe(3)
    })
})

describe('LocalTagRepoImpl 创建与列表', () => {
    beforeEach(async () => {
        await setup()
    })

    const makeTagEntity = (name: string) =>
        // 模拟调用方：create 传入 id 为空串的实体（TagEntity._createWithEmpty 语义）
        new TagEntity(
            '',
            new Date().toISOString(),
            new Date().toISOString(),
            null,
            'more2',
            name,
            '',
            '#666666',
            1
        )

    it('创建后自动生成唯一 id，list 可正常展示（名称解密正确）', async () => {
        const repo = new LocalTagRepoImpl()
        const [first, err1] = await repo.create(makeTagEntity('工作'))
        expect(err1).toBeNull()
        expect(first!.id).not.toBe('')
        const [second, err2] = await repo.create(makeTagEntity('生活'))
        expect(err2).toBeNull()
        expect(second!.id).not.toBe(first!.id)

        const [listResult, listErr] = await repo.list()
        expect(listErr).toBeNull()
        expect(listResult!.map((tag) => tag.name).sort()).toEqual(['工作', '生活'])
        expect(listResult!.every((tag) => tag.id !== '')).toBe(true)
    })

    it('getById 按生成的 id 可取回', async () => {
        const repo = new LocalTagRepoImpl()
        const [created] = await repo.create(makeTagEntity('重要'))
        const [fetched, err] = await repo.getById(created!.id)
        expect(err).toBeNull()
        expect(fetched!.name).toBe('重要')
    })
})

describe('LocalPomodoroRecordRepoImpl 记录列表', () => {
    beforeEach(async () => {
        await setup()
    })

    const makeRecord = (overrides: Partial<CreatePomodoroRecordValueObject> = {}) =>
        new CreatePomodoroRecordValueObject(
            overrides.sessionId ?? `session-${crypto.randomUUID()}`,
            overrides.type ?? 1,
            overrides.startAt ?? new Date().toISOString(),
            overrides.endAt ?? new Date().toISOString(),
            overrides.duration ?? 1500,
            overrides.pomodoroId ?? 'pomodoro-a',
            overrides.taskId ?? '',
            overrides.taskName ?? '',
            overrides.description ?? '',
            overrides.note ?? ''
        )

    it('按 pomodoroId 过滤：只返回该模板的记录', async () => {
        const repo = new LocalPomodoroRecordRepoImpl()
        await repo.create(makeRecord({ pomodoroId: 'pomodoro-a' }))
        await repo.create(makeRecord({ pomodoroId: 'pomodoro-a' }))
        await repo.create(makeRecord({ pomodoroId: 'pomodoro-b' }))

        const [result, err] = await repo.list('pomodoroId=pomodoro-a')
        expect(err).toBeNull()
        expect(result!.entities).toHaveLength(2)
        expect(result!.entities.every((r) => r.pomodoroId === 'pomodoro-a')).toBe(true)
    })

    it('分页：limit/page 切片与 pagination 正确', async () => {
        const repo = new LocalPomodoroRecordRepoImpl()
        for (let i = 0; i < 5; i++) {
            await repo.create(
                makeRecord({ startAt: new Date(Date.now() - i * 1000).toISOString() })
            )
        }

        const [page1, err1] = await repo.list('page=1&limit=2')
        expect(err1).toBeNull()
        expect(page1!.entities).toHaveLength(2)
        expect(page1!.pagination).toEqual({ total: 5, page: 1, limit: 2, maxPage: 3 })

        const [page3, err3] = await repo.list('page=3&limit=2')
        expect(err3).toBeNull()
        expect(page3!.entities).toHaveLength(1)
        expect(page3!.pagination!.maxPage).toBe(3)
    })

    it('切换 pomodoroId 返回不同记录（常用专注切换刷新）', async () => {
        const repo = new LocalPomodoroRecordRepoImpl()
        await repo.create(makeRecord({ pomodoroId: 'pomodoro-a' }))
        await repo.create(makeRecord({ pomodoroId: 'pomodoro-b' }))

        const [forA] = await repo.list('pomodoroId=pomodoro-a')
        const [forB] = await repo.list('pomodoroId=pomodoro-b')

        expect(forA!.entities.map((r) => r.pomodoroId)).toEqual(['pomodoro-a'])
        expect(forB!.entities.map((r) => r.pomodoroId)).toEqual(['pomodoro-b'])
    })
})

describe('LocalPomodoroRecordRepoImpl 累计时长累加', () => {
    beforeEach(async () => {
        await setup('user-1')
    })

    const makeRecord = (overrides: Partial<CreatePomodoroRecordValueObject> = {}) =>
        new CreatePomodoroRecordValueObject(
            overrides.sessionId ?? `session-${crypto.randomUUID()}`,
            overrides.type ?? 1,
            overrides.startAt ?? new Date().toISOString(),
            overrides.endAt ?? new Date().toISOString(),
            overrides.duration ?? 1500,
            overrides.pomodoroId ?? 'pomodoro-a',
            overrides.taskId ?? '',
            overrides.taskName ?? '',
            overrides.description ?? '',
            overrides.note ?? ''
        )

    const createPomodoro = async (name = '模板') => {
        const [entity, err] = await new LocalPomodoroRepoImpl().create(
            new CreatePomodoroValueObject(1, name, '描述', 1500)
        )
        expect(err).toBeNull()
        return entity!
    }

    it('完成专注后 totalDuration 累加本次时长', async () => {
        const pomodoro = await createPomodoro()
        // 初始 totalDuration = 单次时长（1500）
        expect(pomodoro.totalDuration).toBe(1500)

        const repo = new LocalPomodoroRecordRepoImpl()
        await repo.create(makeRecord({ pomodoroId: pomodoro.id, duration: 1500 }))

        const [updated] = await new LocalPomodoroRepoImpl().get(pomodoro.id)
        expect(updated!.totalDuration).toBe(3000)
    })

    it('多次完成专注逐次累加', async () => {
        const pomodoro = await createPomodoro()
        const repo = new LocalPomodoroRecordRepoImpl()
        await repo.create(makeRecord({ pomodoroId: pomodoro.id, duration: 1500 }))
        await repo.create(makeRecord({ pomodoroId: pomodoro.id, duration: 1500 }))
        await repo.create(makeRecord({ pomodoroId: pomodoro.id, duration: 1200 }))

        const [updated] = await new LocalPomodoroRepoImpl().get(pomodoro.id)
        expect(updated!.totalDuration).toBe(1500 + 1500 + 1500 + 1200)
    })

    it('pomodoroId 为空时不影响累计时长', async () => {
        const pomodoro = await createPomodoro()
        const repo = new LocalPomodoroRecordRepoImpl()
        await repo.create(makeRecord({ pomodoroId: null as unknown as string }))

        const [updated] = await new LocalPomodoroRepoImpl().get(pomodoro.id)
        expect(updated!.totalDuration).toBe(1500)
    })

    it('多用户隔离：他人记录不累加本用户常用专注', async () => {
        const pomodoro = await createPomodoro()
        const recordRepo = new LocalPomodoroRecordRepoImpl()

        // user-2 用 user-1 的 pomodoroId 创建记录：应跳过累加
        await switchUser('user-2')
        await recordRepo.create(makeRecord({ pomodoroId: pomodoro.id, duration: 999 }))
        await switchUser('user-1')

        const [updated] = await new LocalPomodoroRepoImpl().get(pomodoro.id)
        expect(updated!.totalDuration).toBe(1500)
    })
})