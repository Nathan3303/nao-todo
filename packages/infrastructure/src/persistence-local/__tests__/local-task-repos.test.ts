import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import dayjs from 'dayjs'
import { TaskDomain, UpdateTaskValueObject } from '@nao-todo/domain-task'
import { QueryOptionsValueObject } from '@nao-todo/shared'
import { localDatabase } from '../db/local-database'
import { LocalTaskRepoImpl } from '../repos/task-repo-impl'
import { makeTaskVO, setup } from './local-repos-test-helpers'

describe('LocalTaskRepoImpl', () => {
    beforeEach(async () => {
        await setup()
    })

    it('create → list 往返，内容字段为明文自描述格式（C-46）', async () => {
        const repo = new LocalTaskRepoImpl()
        const [created, err] = await repo.create(makeTaskVO({ name: '买牛奶' }))
        expect(err).toBeNull()

        const record = await localDatabase.tasks.get(created!.id)
        expect(record!.name).toBe('plain:买牛奶')

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
        // Snooze 同步提醒时刻（DateSelector 显示条件：remindAt 与 remindTime 双非空）
        expect(after!.remindTime).toBe(dayjs(newRemindAt!).format('HH:mm'))
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

    it('relativeDate=today 下今日及未来截止任务保留（未到期可继续完成），已过期排除', async () => {
        const repo = new LocalTaskRepoImpl()
        await repo.create(makeTaskVO({ name: '无截止时间', endAt: null }))
        await repo.create(
            makeTaskVO({ name: '已过期', endAt: dayjs().subtract(1, 'day').toISOString() })
        )
        await repo.create(
            makeTaskVO({ name: '今日到期', endAt: dayjs().add(1, 'hour').toISOString() })
        )
        await repo.create(
            makeTaskVO({ name: '明日到期', endAt: dayjs().add(1, 'day').toISOString() })
        )

        const [result, err] = await repo.list('isDeleted=false&relativeDate=today')
        expect(err).toBeNull()
        expect(result!.taskEntities.map((t) => t.name).sort()).toEqual(['今日到期', '明日到期'])
    })

    it('deletedAt 为空串（远程拉取未删记录）时按未删除处理', async () => {
        const repo = new LocalTaskRepoImpl()
        const [task, createErr] = await repo.create(makeTaskVO({ name: '远程任务' }))
        expect(createErr).toBeNull()
        // 模拟远程同步拉取写入：deletedAt 为 ''（后端空串表示未删）
        const record = await localDatabase.tasks.get(task!.id)
        expect(record).toBeDefined()
        await localDatabase.tasks.put({ ...record!, deletedAt: '' })

        // 默认查询显示（未删）
        const [defaultResult] = await repo.list()
        expect(defaultResult!.taskEntities.map((t) => t.name)).toContain('远程任务')
        // isDeleted=false 匹配
        const [notDeleted] = await repo.list('isDeleted=false')
        expect(notDeleted!.taskEntities.map((t) => t.name)).toContain('远程任务')
        // isDeleted=true 不匹配
        const [deleted] = await repo.list('isDeleted=true')
        expect(deleted!.taskEntities.map((t) => t.name)).not.toContain('远程任务')
    })

    it('archivedAt 为空串（远程拉取未归档记录）时 isArchived=false 仍命中', async () => {
        const repo = new LocalTaskRepoImpl()
        const [a, createErr] = await repo.create(makeTaskVO({ name: '空串归档字段' }))
        expect(createErr).toBeNull()
        await repo.create(makeTaskVO({ name: '正常归档字段' }))
        // 模拟远程同步拉取写入：未归档 archivedAt 为 ''（后端空串惯例，同 deletedAt）
        const record = await localDatabase.tasks.get(a!.id)
        await localDatabase.tasks.put({ ...record!, archivedAt: '' })

        const [result, err] = await repo.list('isDeleted=false&isArchived=false')
        expect(err).toBeNull()
        expect(result!.taskEntities.map((t) => t.name).sort()).toEqual([
            '正常归档字段',
            '空串归档字段'
        ])
        // isArchived=true 同样不把空串误判为已归档
        const [archived] = await repo.list('isDeleted=false&isArchived=true')
        expect(archived!.taskEntities).toHaveLength(0)
    })

    it('starMarkAt 为空串（远程/本地 unstar 惯例）时 isStarMarked 过滤语义正确', async () => {
        const repo = new LocalTaskRepoImpl()
        const [blank] = await repo.create(makeTaskVO({ name: '空串星标' }))
        const [starred] = await repo.create(makeTaskVO({ name: '已星标' }))
        const [none] = await repo.create(makeTaskVO({ name: 'null星标' }))
        // 模拟远程同步/本地 unstar 写入：starMarkAt 为 ''
        const blankRecord = await localDatabase.tasks.get(blank!.id)
        await localDatabase.tasks.put({ ...blankRecord!, starMarkAt: '' })
        // 已星标：经仓储 update 写入合法时间
        const updateVO = new UpdateTaskValueObject(starred!.id)
        updateVO.starMarkAt = new Date().toISOString()
        await repo.update(starred!.id, updateVO)

        const [notStarred] = await repo.list('isDeleted=false&isStarMarked=false')
        expect(notStarred!.taskEntities.map((t) => t.name).sort()).toEqual(['null星标', '空串星标'])
        const [isStarred] = await repo.list('isDeleted=false&isStarMarked=true')
        expect(isStarred!.taskEntities.map((t) => t.name)).toEqual(['已星标'])

        // 读边界归一：空串在实体层表现为 null
        const [entity] = await repo.get(blank!.id)
        expect(entity!.starMarkAt).toBeNull()
        const [archivedEntity] = await repo.get(none!.id)
        expect(archivedEntity!.archivedAt).toBeNull()
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

    it('默认（未传 isDeleted）不查询已删除任务', async () => {
        const repo = new LocalTaskRepoImpl()
        await repo.create(makeTaskVO({ name: 'A' }))
        const [b] = await repo.create(makeTaskVO({ name: 'B' }))
        await repo.remove(b!.id)

        const [defaultList] = await repo.list()
        expect(defaultList!.taskEntities.map((t) => t.name)).toEqual(['A'])

        const [deletedList] = await repo.list('isDeleted=true')
        expect(deletedList!.taskEntities.map((t) => t.name)).toEqual(['B'])

        const [activeList] = await repo.list('isDeleted=false')
        expect(activeList!.taskEntities.map((t) => t.name)).toEqual(['A'])
    })

    it('默认（未传 isDeleted）不查询已删除的子任务', async () => {
        const repo = new LocalTaskRepoImpl()
        const [parent] = await repo.create(makeTaskVO({ name: '父任务' }))
        const [sub] = await repo.create(makeTaskVO({ name: '子任务', parentTaskId: parent!.id }))
        await repo.remove(sub!.id)

        const [defaultList] = await repo.list(`parentTaskId=${encodeURIComponent(parent!.id)}`)
        expect(defaultList!.taskEntities).toHaveLength(0)

        const [deletedList] = await repo.list(
            `parentTaskId=${encodeURIComponent(parent!.id)}&isDeleted=true`
        )
        expect(deletedList!.taskEntities.map((t) => t.name)).toEqual(['子任务'])
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

    it('sort=field:order 排序生效（修复前 JSON.parse 解析失败被静默忽略）', async () => {
        const repo = new LocalTaskRepoImpl()
        await repo.create(makeTaskVO({ name: 'banana' }))
        await repo.create(makeTaskVO({ name: 'apple' }))
        await repo.create(makeTaskVO({ name: 'cherry' }))

        const [asc] = await repo.list('isDeleted=false&sort=name:asc')
        expect(asc!.taskEntities.map((t) => t.name)).toEqual(['apple', 'banana', 'cherry'])

        const [desc] = await repo.list('isDeleted=false&sort=name:desc')
        expect(desc!.taskEntities.map((t) => t.name)).toEqual(['cherry', 'banana', 'apple'])
    })

    it('sort 经 TaskDomain + QueryOptionsValueObject 完整链路（field:order）解析生效', async () => {
        const repo = new LocalTaskRepoImpl()
        await repo.create(makeTaskVO({ name: 'banana' }))
        await repo.create(makeTaskVO({ name: 'apple' }))

        // 模拟桌面端真实调用链：TaskUseCase.list → TaskDomain.listTasks → repo.list
        const domain = new TaskDomain(repo)
        const [result, err] = await domain.listTasks(
            new QueryOptionsValueObject({
                isDeleted: false,
                sort: { field: 'name', order: 'desc' }
            })
        )
        expect(err).toBeNull()
        expect(result!.taskEntities.map((t) => t.name)).toEqual(['banana', 'apple'])
    })

    it('父子数据成环（历史脏数据）时级联删除不死循环', async () => {
        const repo = new LocalTaskRepoImpl()
        const [a] = await repo.create(makeTaskVO({ name: '任务A' }))
        const [b] = await repo.create(makeTaskVO({ name: '任务B' }))
        // 直接注入环：A 的父是 B，B 的父是 A（绕过守卫的历史脏数据）
        const recA = await localDatabase.tasks.get(a!.id)
        await localDatabase.tasks.put({ ...recA!, parentTaskId: b!.id })
        const recB = await localDatabase.tasks.get(b!.id)
        await localDatabase.tasks.put({ ...recB!, parentTaskId: a!.id })

        // 删除 A：级联应终止且不抛异常（visited 集合兜底）
        await expect(repo.remove(a!.id)).resolves.toBeNull()
        const [afterA] = await repo.get(a!.id)
        const [afterB] = await repo.get(b!.id)
        expect(afterA!.deletedAt).not.toBeNull()
        expect(afterB!.deletedAt).not.toBeNull()
    })
})