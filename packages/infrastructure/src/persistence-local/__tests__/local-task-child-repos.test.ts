import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateTaskCheckItemValueObject, CreateTaskCommentValueObject } from '@nao-todo/domain-task'
import { localDatabase } from '../db/local-database'
import { LocalTaskCheckItemRepoImpl } from '../repos/task-check-item-repo-impl'
import { LocalTaskCommentRepoImpl } from '../repos/task-comment-repo-impl'
import { setup, switchUser } from './local-repos-test-helpers'

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

describe('TaskCheckItem 软删过滤', () => {
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

    it('软删（repo.delete）后 list 不再返回该项，墓碑仍在库中', async () => {
        const repo = new LocalTaskCheckItemRepoImpl()
        const item = await createItem(repo, 'task-1', '待删项')

        const deleteErr = await repo.delete(item.id)
        expect(deleteErr).toBeNull()

        // 软删语义：记录保留（deletedAt 置位），仅查询过滤
        const tombstone = await localDatabase.taskCheckItems.get(item.id)
        expect(tombstone?.deletedAt).not.toBeNull()

        const [listResult, err] = await repo.list('task-1')
        expect(err).toBeNull()
        expect(listResult).toEqual([])
    })

    it('deletedAt 为空串（远端同步拉取的未删记录）视为未删除，list 返回', async () => {
        const repo = new LocalTaskCheckItemRepoImpl()
        const item = await createItem(repo, 'task-1', '远端未删项')

        // 模拟远程同步写入：后端空串表示未删（见 isNotDeleted 语义）
        const record = await localDatabase.taskCheckItems.get(item.id)
        record!.deletedAt = ''
        await localDatabase.taskCheckItems.put(record!)

        const [listResult, err] = await repo.list('task-1')
        expect(err).toBeNull()
        expect(listResult!.map((i) => i.id)).toEqual([item.id])
    })

    it('混合场景：已删项被过滤，未删项保留且按 sortId 升序', async () => {
        const repo = new LocalTaskCheckItemRepoImpl()
        const a = await createItem(repo, 'task-1', '保留项A')
        const b = await createItem(repo, 'task-1', '删除项B')
        const c = await createItem(repo, 'task-1', '保留项C')

        await repo.delete(b.id)

        const [listResult, err] = await repo.list('task-1')
        expect(err).toBeNull()
        expect(listResult!.map((i) => i.id)).toEqual([a.id, c.id])
        expect(listResult!.map((i) => i.sortId)).toEqual([1, 3])
    })
})

describe('TaskComment 软删过滤', () => {
    beforeEach(async () => {
        await setup('user-1')
    })

    const createComment = async (
        repo: LocalTaskCommentRepoImpl,
        taskId: string,
        content: string
    ) => {
        const [entity, err] = await repo.create(
            new CreateTaskCommentValueObject(taskId, content, [], false)
        )
        expect(err).toBeNull()
        return entity!
    }

    it('软删（repo.delete）后 list 不再返回该评论，墓碑仍在库中', async () => {
        const repo = new LocalTaskCommentRepoImpl()
        const comment = await createComment(repo, 'task-1', '待删评论')

        const deleteErr = await repo.delete(comment.id)
        expect(deleteErr).toBeNull()

        // 软删语义：记录保留（deletedAt 置位），仅查询过滤
        const tombstone = await localDatabase.taskComments.get(comment.id)
        expect(tombstone?.deletedAt).not.toBeNull()

        const [listResult, err] = await repo.list('task-1')
        expect(err).toBeNull()
        expect(listResult).toEqual([])
    })

    it('deletedAt 为空串（远端同步拉取的未删记录）视为未删除，list 返回', async () => {
        const repo = new LocalTaskCommentRepoImpl()
        const comment = await createComment(repo, 'task-1', '远端未删评论')

        // 模拟远程同步写入：后端空串表示未删（见 isNotDeleted 语义）
        const record = await localDatabase.taskComments.get(comment.id)
        record!.deletedAt = ''
        await localDatabase.taskComments.put(record!)

        const [listResult, err] = await repo.list('task-1')
        expect(err).toBeNull()
        expect(listResult!.map((c) => c.id)).toEqual([comment.id])
    })

    it('混合场景：已删评论被过滤，未删评论保留且按 createdAt 升序', async () => {
        const repo = new LocalTaskCommentRepoImpl()
        const a = await createComment(repo, 'task-1', '保留评论A')
        const b = await createComment(repo, 'task-1', '删除评论B')
        const c = await createComment(repo, 'task-1', '保留评论C')

        await repo.delete(b.id)

        const [listResult, err] = await repo.list('task-1')
        expect(err).toBeNull()
        expect(listResult!.map((c) => c.id)).toEqual([a.id, c.id])
    })
})