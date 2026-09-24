import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { UpdateTaskValueObject } from '@nao-todo/domain-task'
import { localDatabase } from '../db/local-database'
import { newLocalTaskRepository } from '../repos/task-repo-impl'
import { syncTracker } from '../../persistence-sync/sync-tracker'
import { makeTaskVO, setup } from './local-repos-test-helpers'

/**
 * W1 任务域本地写 ⇒ `markDirty` 非 0 ⇒ 推送调度（PS-12 / PS-13）
 * @description 阶段二 2A W1：web 任务域写路径切本地仓储（与 desktop 同构）。
 *              本地写成功后由仓储调用 `syncTracker.markDirty` 入 `syncQueue`（同实体去重），
 *              并触发 `dirtyListener`（web `data-plane` 将其接为 `syncService.schedulePush` 防抖推送）。
 *              本文件锁「本地写 ⇒ 队列非空 ⇒ 触发推送调度」这一段；`listener ⇒ schedulePush`
 *              由 `apps/web/src/data-plane.test.ts` 覆盖。
 */

/** 造一条已存在任务，返回其 id（同时清空由 create 产生的队列项） */
const seedTask = async (name: string): Promise<string> => {
    const repo = newLocalTaskRepository()
    const [task, err] = await repo.create(makeTaskVO({ name }))
    expect(err).toBeNull()
    await localDatabase.syncQueue.clear()
    return task!.id
}

describe('W1 任务域本地写 ⇒ markDirty ⇒ 推送调度', () => {
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

    it('本地 create ⇒ syncQueue 入队 1 条（countDirty 非 0）+ 触发 dirty 监听', async () => {
        const repo = newLocalTaskRepository()
        const [task, err] = await repo.create(makeTaskVO({ name: 'W1 本地写' }))
        expect(err).toBeNull()

        expect(await syncTracker.countDirty('test-user')).toBe(1)
        const queued = await syncTracker.listDirty('test-user')
        expect(queued[0]).toMatchObject({
            table: 'tasks',
            entityId: task!.id,
            action: 'upsert',
            userId: 'test-user'
        })
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('本地 update 同实体 ⇒ 队列仍 1 条（PS-13：按实体去重，不无限增长）', async () => {
        const taskId = await seedTask('去重前')
        listener.mockClear()
        const repo = newLocalTaskRepository()
        const first = new UpdateTaskValueObject(taskId)
        first.name = '去重后'
        await repo.update(taskId, first)
        const second = new UpdateTaskValueObject(taskId)
        second.name = '再改一次'
        await repo.update(taskId, second)

        expect(await syncTracker.countDirty('test-user')).toBe(1)
        expect(listener).toHaveBeenCalledTimes(2)
    })

    it('本地 remove ⇒ 队列项 action=delete（删除同样回传，不静默滞留）', async () => {
        const taskId = await seedTask('待删任务')
        const repo = newLocalTaskRepository()
        await repo.remove(taskId)

        const queued = await syncTracker.listDirty('test-user')
        expect(queued[0]).toMatchObject({ table: 'tasks', entityId: taskId, action: 'delete' })
    })
})