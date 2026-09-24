import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
    CreateTaskCheckItemValueObject,
    CreateTaskCommentValueObject,
    UpdateTaskCheckItemValueObject
} from '@nao-todo/domain-task'
import { localDatabase } from '../db/local-database'
import { newLocalTaskCheckItemRepository } from '../repos/task-check-item-repo-impl'
import { newLocalTaskCommentRepository } from '../repos/task-comment-repo-impl'
import { syncTracker } from '../../persistence-sync/sync-tracker'
import { setup } from './local-repos-test-helpers'

/**
 * W2 子实体域（检查项 / 评论）本地写 ⇒ `markDirty` 非 0 ⇒ 推送调度（PS-12 / PS-13）
 * @description 阶段二 2A W2：web 子实体域写路径切本地仓储（与 desktop 同构）。
 *              本地写成功后由仓储调用 `syncTracker.markDirty` 入 `syncQueue`（同实体去重），
 *              并触发 `dirtyListener`（web `data-plane` 将其接为 `syncService.schedulePush` 防抖推送）。
 *              本文件锁「本地写 ⇒ 队列非空 ⇒ 触发推送调度」这一段；离线写闸门撤销由
 *              `apps/web/src/hooks/usecases/__tests__/write-gate-wiring.test.ts` 覆盖。
 */

describe('W2 子实体域本地写 ⇒ markDirty ⇒ 推送调度', () => {
    const listener = vi.fn()

    beforeEach(async () => {
        await setup()
        await localDatabase.syncQueue.clear()
        listener.mockReset()
        syncTracker.setDirtyListener(listener)
    })

    afterEach(() => {
        // 全局单例监听器复位，避免跨用例/跨文件泄漏
        syncTracker.setDirtyListener(() => {})
    })

    it('检查项本地 create ⇒ syncQueue 入队 1 条（countDirty 非 0）+ 触发 dirty 监听', async () => {
        const repo = newLocalTaskCheckItemRepository()
        const [item, err] = await repo.create(
            new CreateTaskCheckItemValueObject('task-1', 'W2 检查项', false, false)
        )
        expect(err).toBeNull()

        expect(await syncTracker.countDirty('test-user')).toBe(1)
        const queued = await syncTracker.listDirty('test-user')
        expect(queued[0]).toMatchObject({
            table: 'taskCheckItems',
            entityId: item!.id,
            action: 'upsert',
            userId: 'test-user'
        })
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('评论本地 create ⇒ syncQueue 入队 1 条（countDirty 非 0）+ 触发 dirty 监听', async () => {
        const repo = newLocalTaskCommentRepository()
        const [comment, err] = await repo.create(
            new CreateTaskCommentValueObject('task-1', 'W2 评论', [], false)
        )
        expect(err).toBeNull()

        expect(await syncTracker.countDirty('test-user')).toBe(1)
        const queued = await syncTracker.listDirty('test-user')
        expect(queued[0]).toMatchObject({
            table: 'taskComments',
            entityId: comment!.id,
            action: 'upsert',
            userId: 'test-user'
        })
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('检查项本地 update 同实体 ⇒ 队列仍 1 条（PS-13：按实体去重，不无限增长）', async () => {
        const repo = newLocalTaskCheckItemRepository()
        const [item] = await repo.create(
            new CreateTaskCheckItemValueObject('task-1', '去重前', false, false)
        )
        await localDatabase.syncQueue.clear()
        listener.mockClear()

        const first = new UpdateTaskCheckItemValueObject(item!.id)
        first.name = '去重后'
        await repo.update(item!.id, first)
        const second = new UpdateTaskCheckItemValueObject(item!.id)
        second.isDone = true
        await repo.update(item!.id, second)

        expect(await syncTracker.countDirty('test-user')).toBe(1)
        expect(listener).toHaveBeenCalledTimes(2)
    })

    it('评论本地 delete ⇒ 队列项 action=delete（删除同样回传，不静默滞留）', async () => {
        const repo = newLocalTaskCommentRepository()
        const [comment] = await repo.create(
            new CreateTaskCommentValueObject('task-1', '待删评论', [], false)
        )
        await repo.delete(comment!.id)

        const queued = await syncTracker.listDirty('test-user')
        expect(queued[0]).toMatchObject({
            table: 'taskComments',
            entityId: comment!.id,
            action: 'delete'
        })
    })
})