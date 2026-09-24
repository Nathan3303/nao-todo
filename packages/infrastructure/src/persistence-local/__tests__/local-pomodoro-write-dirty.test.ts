import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
    CreatePomodoroRecordValueObject,
    CreatePomodoroValueObject,
    UpdatePomodoroValueObject
} from '@nao-todo/domain-pomodoro'
import { localDatabase } from '../db/local-database'
import { newLocalPomodoroRecordRepository } from '../repos/pomodoro-record-repo-impl'
import { newLocalPomodoroRepository } from '../repos/pomodoro-repo-impl'
import { syncTracker } from '../../persistence-sync/sync-tracker'
import { setup } from './local-repos-test-helpers'

/**
 * W4 番茄域（常用番茄 / 专注记录）本地写 ⇒ `markDirty` 非 0 ⇒ 推送调度（PS-12 / PS-13）
 * @description 阶段二 2A W4：web 番茄域写路径切本地仓储（与 desktop 同构）。
 *              本地写成功后由仓储调用 `syncTracker.markDirty` 入 `syncQueue`（同实体去重），
 *              并触发 `dirtyListener`（web `data-plane` 将其接为 `syncService.schedulePush` 防抖推送）。
 *              本文件锁「本地写 ⇒ 队列非空 ⇒ 触发推送调度」这一段；**离线写成功**（闸门已撤、
 *              原方法透传）由 `apps/web/src/hooks/usecases/__tests__/write-gate-wiring.test.ts` 覆盖。
 */

/** 造一个专注记录值对象（`duration > 300` 为领域校验下限） */
const makeRecordVO = (): CreatePomodoroRecordValueObject =>
    new CreatePomodoroRecordValueObject(
        'session-1',
        1,
        new Date().toISOString(),
        new Date().toISOString(),
        1500,
        '',
        '',
        '',
        '',
        ''
    )

describe('W4 番茄域本地写 ⇒ markDirty ⇒ 推送调度', () => {
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

    it('常用番茄本地 create ⇒ syncQueue 入队 1 条（countDirty 非 0）+ 触发 dirty 监听', async () => {
        const repo = newLocalPomodoroRepository()
        const [pomodoro, err] = await repo.create(
            new CreatePomodoroValueObject(1, 'W4 番茄', '专注 25 分钟', 1500)
        )
        expect(err).toBeNull()

        expect(await syncTracker.countDirty('test-user')).toBe(1)
        const queued = await syncTracker.listDirty('test-user')
        expect(queued[0]).toMatchObject({
            table: 'pomodoros',
            entityId: pomodoro!.id,
            action: 'upsert',
            userId: 'test-user'
        })
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('专注记录本地 create ⇒ syncQueue 入队 1 条（countDirty 非 0）+ 触发 dirty 监听', async () => {
        const repo = newLocalPomodoroRecordRepository()
        const [record, err] = await repo.create(makeRecordVO())
        expect(err).toBeNull()

        expect(await syncTracker.countDirty('test-user')).toBe(1)
        const queued = await syncTracker.listDirty('test-user')
        expect(queued[0]).toMatchObject({
            table: 'pomodoroRecords',
            entityId: record!.id,
            action: 'upsert',
            userId: 'test-user'
        })
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('常用番茄本地 update 同实体 ⇒ 队列仍 1 条（PS-13：按实体去重，不无限增长）', async () => {
        const repo = newLocalPomodoroRepository()
        const [pomodoro] = await repo.create(
            new CreatePomodoroValueObject(1, '去重前', '描述', 1500)
        )
        await localDatabase.syncQueue.clear()
        listener.mockClear()

        const first = new UpdatePomodoroValueObject(pomodoro!.id)
        first.name = '去重后'
        await repo.update(first)
        const second = new UpdatePomodoroValueObject(pomodoro!.id)
        second.name = '再改一次'
        await repo.update(second)

        expect(await syncTracker.countDirty('test-user')).toBe(1)
        expect(listener).toHaveBeenCalledTimes(2)
    })

    it('常用番茄本地 delete ⇒ 队列项 action=delete（删除同样回传，不静默滞留）', async () => {
        const repo = newLocalPomodoroRepository()
        const [pomodoro] = await repo.create(
            new CreatePomodoroValueObject(1, '待删番茄', '描述', 1500)
        )
        await repo.delete(pomodoro!.id)

        const queued = await syncTracker.listDirty('test-user')
        expect(queued[0]).toMatchObject({
            table: 'pomodoros',
            entityId: pomodoro!.id,
            action: 'delete'
        })
    })

    it('常用番茄本地 archived ⇒ 队列项 action=upsert（归档同样回传）', async () => {
        const repo = newLocalPomodoroRepository()
        const [pomodoro] = await repo.create(
            new CreatePomodoroValueObject(1, '待归档番茄', '描述', 1500)
        )
        await repo.archived(pomodoro!.id)

        const queued = await syncTracker.listDirty('test-user')
        expect(queued[0]).toMatchObject({
            table: 'pomodoros',
            entityId: pomodoro!.id,
            action: 'upsert'
        })
    })
})