// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { getServerTimeOffset, nowCalibratedIso, setServerTimeOffset } from '../sync-config'
import { syncTracker } from '../sync-tracker'

/**
 * T144 / PS-15 —— 本地写时间基准走服务端校准值
 *
 * **缺口**：`getServerTimeOffset` 只写不读（`sync-service.calibrateServerTime` 写入、全仓无读取点）；
 * 本地仓储写 `updatedAt` 用裸 `new Date()` ⇒ 客户端时钟偏移直接决定服务端 `DecideUpsert` 的冲突结果。
 *
 * **验收**：① 偏移写入后 `getServerTimeOffset` 读到；② 本地创建实体的 `updatedAt` = 本地时钟 + 偏移；
 * ③ `syncQueue.localUpdatedAt` 与实体 `updatedAt` 一致（同一校准基准）。
 */

const USER_ID = 'calib-user'
const HOUR_MS = 60 * 60 * 1000

const setup = async (): Promise<void> => {
    await localDatabase.tasks.clear()
    await localDatabase.meta.clear()
    await localDatabase.syncQueue.clear()
    localStorage.clear()
    cryptoService.lock()
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
}

const createTask = () =>
    newLocalTaskRepository().create(
        new CreateTaskValueObject(
            null,
            null,
            '任务',
            '',
            'todo',
            'medium',
            null,
            null,
            'p-1',
            [],
            null,
            'none',
            null,
            []
        )
    )

describe('T144 / PS-15 本地写时间基准 = 服务端校准值', () => {
    beforeEach(async () => {
        await setup()
    })

    it('nowCalibratedIso 读取 getServerTimeOffset：偏移为正/负均生效', () => {
        setServerTimeOffset(0)
        const baseline = Date.now()
        const at0 = Date.parse(nowCalibratedIso())
        expect(Math.abs(at0 - baseline)).toBeLessThan(2000)

        setServerTimeOffset(2 * HOUR_MS)
        expect(getServerTimeOffset()).toBe(2 * HOUR_MS)
        expect(Date.parse(nowCalibratedIso()) - Date.now()).toBeGreaterThan(2 * HOUR_MS - 2000)

        setServerTimeOffset(-1 * HOUR_MS)
        expect(Date.parse(nowCalibratedIso()) - Date.now()).toBeLessThan(-1 * HOUR_MS + 2000)
    })

    it('本地创建任务：entity.updatedAt = 本地时钟 + 服务端偏移（不再用裸 new Date）', async () => {
        setServerTimeOffset(HOUR_MS)
        const before = Date.now()
        const [task, err] = await createTask()
        const after = Date.now()
        expect(err).toBeNull()
        const ts = Date.parse((task as { updatedAt: string }).updatedAt)
        expect(ts).toBeGreaterThanOrEqual(before + HOUR_MS - 50)
        expect(ts).toBeLessThanOrEqual(after + HOUR_MS + 50)
    })

    it('入队 localUpdatedAt 与实体 updatedAt 一致（同一校准基准）', async () => {
        setServerTimeOffset(HOUR_MS)
        const [task] = await createTask()
        const entityUpdatedAt = (task as { updatedAt: string }).updatedAt
        const queue = await syncTracker.listDirty(USER_ID)
        expect(queue).toHaveLength(1)
        expect(queue[0]!.localUpdatedAt).toBe(entityUpdatedAt)
    })

    it('无偏移（未校准）⇒ 回退本地时钟（getServerTimeOffset 缺省 0）', async () => {
        setServerTimeOffset(0)
        const before = Date.now()
        const [task] = await createTask()
        const ts = Date.parse((task as { updatedAt: string }).updatedAt)
        expect(ts).toBeGreaterThanOrEqual(before - 50)
        expect(ts).toBeLessThanOrEqual(Date.now() + 50)
    })
})