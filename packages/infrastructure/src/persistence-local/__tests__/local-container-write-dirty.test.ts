import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { CreateProjectValueObject, UpdateProjectValueObject } from '@nao-todo/domain-project'
import { TagEntity } from '@nao-todo/domain-tag'
import { localDatabase } from '../db/local-database'
import { newLocalProjectRepository } from '../repos/project-repo-impl'
import { newLocalTagRepository } from '../repos/tag-repo-impl'
import { syncTracker } from '../../persistence-sync/sync-tracker'
import { setup } from './local-repos-test-helpers'

/**
 * W3 容器域（清单 / 标签）本地写 ⇒ `markDirty` 非 0 ⇒ 推送调度（PS-12 / PS-13）
 * @description 阶段二 2A W3：web 容器域写路径切本地仓储（与 desktop 同构）。
 *              本地写成功后由仓储调用 `syncTracker.markDirty` 入 `syncQueue`（同实体去重），
 *              并触发 `dirtyListener`（web `data-plane` 将其接为 `syncService.schedulePush` 防抖推送）。
 *              本文件锁「本地写 ⇒ 队列非空 ⇒ 触发推送调度」这一段；**离线写成功**（闸门已撤、
 *              原方法透传）由 `apps/web/src/hooks/usecases/__tests__/write-gate-wiring.test.ts` 覆盖。
 */

/** 造一个 id 为空的标签实体（`TagEntity._createWithEmpty` 语义，create 时自生成 id） */
const makeTagEntity = (name: string): TagEntity =>
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

describe('W3 容器域本地写 ⇒ markDirty ⇒ 推送调度', () => {
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

    it('清单本地 create ⇒ syncQueue 入队 1 条（countDirty 非 0）+ 触发 dirty 监听', async () => {
        const repo = newLocalProjectRepository()
        const [project, err] = await repo.create(
            new CreateProjectValueObject('W3 清单', 'more2', '')
        )
        expect(err).toBeNull()

        expect(await syncTracker.countDirty('test-user')).toBe(1)
        const queued = await syncTracker.listDirty('test-user')
        expect(queued[0]).toMatchObject({
            table: 'projects',
            entityId: project!.id,
            action: 'upsert',
            userId: 'test-user'
        })
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('标签本地 create ⇒ syncQueue 入队 1 条（countDirty 非 0）+ 触发 dirty 监听', async () => {
        const repo = newLocalTagRepository()
        const [tag, err] = await repo.create(makeTagEntity('W3 标签'))
        expect(err).toBeNull()

        expect(await syncTracker.countDirty('test-user')).toBe(1)
        const queued = await syncTracker.listDirty('test-user')
        expect(queued[0]).toMatchObject({
            table: 'tags',
            entityId: tag!.id,
            action: 'upsert',
            userId: 'test-user'
        })
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('清单本地 update 同实体 ⇒ 队列仍 1 条（PS-13：按实体去重，不无限增长）', async () => {
        const repo = newLocalProjectRepository()
        const [project] = await repo.create(new CreateProjectValueObject('去重前', 'more2', ''))
        await localDatabase.syncQueue.clear()
        listener.mockClear()

        const first = new UpdateProjectValueObject(project!.id)
        first.name = '去重后'
        await repo.update(first)
        const second = new UpdateProjectValueObject(project!.id)
        second.name = '再改一次'
        await repo.update(second)

        expect(await syncTracker.countDirty('test-user')).toBe(1)
        expect(listener).toHaveBeenCalledTimes(2)
    })

    it('清单本地 delete ⇒ 队列项 action=delete（删除同样回传，不静默滞留）', async () => {
        const repo = newLocalProjectRepository()
        const [project] = await repo.create(new CreateProjectValueObject('待删清单', 'more2', ''))
        await repo.delete(project!.id)

        const queued = await syncTracker.listDirty('test-user')
        expect(queued[0]).toMatchObject({
            table: 'projects',
            entityId: project!.id,
            action: 'delete'
        })
    })

    it('标签本地 delete ⇒ 队列项 action=delete（删除同样回传，不静默滞留）', async () => {
        const repo = newLocalTagRepository()
        const [tag] = await repo.create(makeTagEntity('待删标签'))
        await repo.deleteById(tag!.id)

        const queued = await syncTracker.listDirty('test-user')
        expect(queued[0]).toMatchObject({ table: 'tags', entityId: tag!.id, action: 'delete' })
    })
})