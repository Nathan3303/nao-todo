import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { TaskRepository } from '@nao-todo/domain-task'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../../persistence-local/session/local-session'
import { SyncStatus } from '../../../persistence-sync/sync-status'
import { withMirrorFallback } from '../mirror-fallback'

/**
 * 远端优先 + 网络类失败回退本地镜像（C-66 / AC8 / AC9 数据面）
 * @description AC8：离线（远端抛网络错误）+ 有镜像 ⇒ 回退读到镜像数据（`mirrorPulledAt` 由
 *              `SyncStatus` 提供，供 UI 显示「数据截至 X」）。
 *              AC9：离线 + 无镜像 ⇒ 数据面**不抛错、返回空集**（不呈现为数据丢失），
 *              且 `mirrorPulledAt === null` 可把「未同步完成」与「空库」区分开。
 */

const USER_ID = 'test-user'

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

/** 构造「读方法抛错、写方法可观测」的远端替身 */
const makeRemote = (error: unknown) => {
    const create = vi.fn(async () => [null, null] as unknown)
    const list = vi.fn(async () => {
        throw error
    })
    const get = vi.fn(async () => {
        throw error
    })
    const remote = {
        get,
        list,
        create,
        update: vi.fn(async () => null),
        remove: vi.fn(async () => null),
        restore: vi.fn(async () => null),
        copy: vi.fn(async () => {
            throw error
        }),
        snooze: vi.fn(async () => [null, null])
    } as unknown as TaskRepository
    return { remote, create, list }
}

const setup = async (): Promise<void> => {
    await localDatabase.tasks.clear()
    await localDatabase.meta.clear()
    cryptoService.lock()
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
}

describe('withMirrorFallback - AC8（离线 + 有镜像）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('远端抛网络错误 ⇒ 回退本地镜像读取，pagination.total 一并提供，mirrorPulledAt 有值', async () => {
        const mirror = newLocalTaskRepository()
        const [created, createErr] = await mirror.create(makeTaskVO({ name: '离线任务' }))
        expect(createErr).toBeNull()

        // 一次「完整拉取」落定 mirrorPulledAt（T103 语义：仅完整拉取推进）
        const status = new SyncStatus()
        status.beginRun('pull')
        status.markMirrorPulled()
        status.endRun({ pendingCount: 0, failedCount: 0 })

        const { remote, list } = makeRemote(new Error('Network Error'))
        const repo = withMirrorFallback<TaskRepository>(remote, mirror, ['get', 'list'])

        const [result, err] = await repo.list('')
        expect(err).toBeNull()
        expect(result!.taskEntities.map((task) => task.name)).toContain('离线任务')
        expect(result!.pagination!.total).toBe(1)

        const [fetched, fetchErr] = await repo.get(created!.id)
        expect(fetchErr).toBeNull()
        expect(fetched!.name).toBe('离线任务')
        expect(list).toHaveBeenCalled()
        expect(status.get().mirrorPulledAt).not.toBeNull()
    })
})

describe('withMirrorFallback - AC9（离线 + 无镜像）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('无镜像 ⇒ 回退返回空集（不抛错、不呈现数据丢失），且 mirrorPulledAt 为 null 以区分「未同步完成」', async () => {
        const mirror = newLocalTaskRepository()
        const status = new SyncStatus()
        const { remote } = makeRemote(new Error('Network Error'))
        const repo = withMirrorFallback<TaskRepository>(remote, mirror, ['get', 'list'])

        const [result, err] = await repo.list('')
        expect(err).toBeNull()
        expect(result!.taskEntities).toEqual([])
        expect(result!.pagination!.total).toBe(0)
        // 「未同步完成」判据（C-60③ / AC9）：mirrorPulledAt 为 null（非 1970/无效值）
        expect(status.get().mirrorPulledAt).toBeNull()
        expect(status.get().mirrorTruncated).toBe(false)

        // 对照：同为「空集」，完整拉取后 mirrorPulledAt 有值 ⇒ 两态可区分
        status.beginRun('pull')
        status.markMirrorPulled()
        status.endRun({ pendingCount: 0, failedCount: 0 })
        expect(status.get().mirrorPulledAt).not.toBeNull()
    })
})

describe('withMirrorFallback - 边界', () => {
    beforeEach(async () => {
        await setup()
    })

    it('远端成功 ⇒ 直接返回远端结果，镜像不参与', async () => {
        const mirror = newLocalTaskRepository()
        const remote = {
            list: vi.fn(async () => [
                { taskEntities: [{ name: '远端任务' }], pagination: undefined }
            ]),
            get: vi.fn()
        } as unknown as TaskRepository
        const repo = withMirrorFallback<TaskRepository>(remote, mirror, ['get', 'list'])

        const [result] = await repo.list('')
        expect(result!.taskEntities[0]!.name).toBe('远端任务')
    })

    it('凭证类失败（10041/401/过期文案）必须上抛，不得用镜像掩盖', async () => {
        const mirror = newLocalTaskRepository()
        const { remote } = makeRemote(new Error('登录已过期，请重新登录'))
        const repo = withMirrorFallback<TaskRepository>(remote, mirror, ['get', 'list'])

        await expect(repo.get('task-1')).rejects.toThrow('登录已过期')
        await expect(repo.list('')).rejects.toThrow('登录已过期')
    })

    it('写方法一律透传远端（C-59：阶段一数据面不产生 markDirty）', async () => {
        const mirror = newLocalTaskRepository()
        const mirrorCreate = vi.spyOn(mirror, 'create')
        const { remote, create } = makeRemote(new Error('Network Error'))
        const repo = withMirrorFallback<TaskRepository>(remote, mirror, ['get', 'list'])

        await repo.create(makeTaskVO({ name: '写入' }))
        expect(create).toHaveBeenCalledTimes(1)
        expect(mirrorCreate).not.toHaveBeenCalled()
    })
})