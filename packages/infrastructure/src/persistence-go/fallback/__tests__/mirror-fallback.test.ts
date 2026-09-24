// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { TaskRepository } from '@nao-todo/domain-task'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import type { Requester } from '@nao-todo/shared'
import { initRequester } from '@nao-todo/shared/requester'
import { cryptoService } from '../../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../../persistence-local/session/local-session'
import { SyncStatus } from '../../../persistence-sync/sync-status'
import { TaskRepoImpl } from '../../task/task-repo-impl'
import { withMirrorFallback } from '../mirror-fallback'
import { isNormalizedNetworkError } from '../network-failure'

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

/**
 * 构造真实抛出型 axios Error（axios v1：4xx=`ERR_BAD_REQUEST` / 5xx=`ERR_BAD_RESPONSE`）
 * @description 抛出分支的真实生产形态（`packages/shared/requester/axios.ts:107-109` 的 `default:` reject）。
 */
const makeThrownHttpError = (status: number, code: string): Error =>
    Object.assign(new Error(`Request failed with status code ${status}`), {
        code,
        response: { status }
    })

/**
 * requester 归一化网络错误响应（`packages/shared/requester/axios.ts:73-104` 原样产物，**不 reject**）
 * @description 真实离线形态：`resolve` 顶层字符串 code + 业务码 50300/40800/42900。
 */
const NORMALIZED_NETWORK_ERRORS = [
    { code: 'ERR_NETWORK', message: '网络错误，请检查您的网络连接', bizCode: 50300 },
    { code: 'ECONNABORTED', message: '请求超时，请稍后再试', bizCode: 40800 },
    { code: 'TOO_MANY_REQUESTS', message: '请求过于频繁，请稍后再试', bizCode: 42900 }
] as const

/** 构造**真实** `TaskRepoImpl`（仅替换 requester 为返回指定响应的替身） */
const makeRealRemote = (response: unknown): TaskRepository =>
    new TaskRepoImpl({
        get: vi.fn(async () => response),
        post: vi.fn(async () => response),
        put: vi.fn(async () => response),
        delete: vi.fn(async () => response)
    } as unknown as Requester)

/** 向真实本地镜像种入一条任务 */
const seedMirror = async (name: string) => {
    const mirror = newLocalTaskRepository()
    const [created, err] = await mirror.create(makeTaskVO({ name }))
    expect(err).toBeNull()
    return { mirror, created: created! }
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

        const { remote, list } = makeRemote(makeThrownHttpError(500, 'ERR_BAD_RESPONSE'))
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
        const { remote } = makeRemote(makeThrownHttpError(500, 'ERR_BAD_RESPONSE'))
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

    it('凭证结构信号（HTTP 401 / 业务码 10041）必须上抛，不得用镜像掩盖', async () => {
        const mirror = newLocalTaskRepository()
        const { remote } = makeRemote(Object.assign(new Error('用户凭证验证失败'), { code: 10041 }))
        const repo = withMirrorFallback<TaskRepository>(remote, mirror, ['get', 'list'])

        await expect(repo.get('task-1')).rejects.toThrow('用户凭证验证失败')
        await expect(repo.list('')).rejects.toThrow('用户凭证验证失败')
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

/**
 * r12 / T160：读路径回退门 = **fail-soft**（抛出分支仅已知凭证**结构**信号上抛）
 * @description 抛出 = 远端未应答 ⇒ 除已知凭证结构信号外一律回退镜像；
 *              元组分支不变（远端已应答 ⇒ 仅归一化网络元组回退）。
 */
describe('withMirrorFallback - 抛出型回退门（r12 / T160 fail-soft）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('非归一化 HTTP 5xx / 网关 502·504 / 抛出型 ERR_NETWORK ⇒ 回退镜像', async () => {
        const { mirror, created } = await seedMirror('回退任务')
        const thrownCases = [
            makeThrownHttpError(500, 'ERR_BAD_RESPONSE'),
            makeThrownHttpError(502, 'ERR_BAD_RESPONSE'),
            makeThrownHttpError(504, 'ERR_BAD_RESPONSE'),
            Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
        ]

        for (const thrown of thrownCases) {
            const { remote, list } = makeRemote(thrown)
            const repo = withMirrorFallback<TaskRepository>(remote, mirror, ['get', 'list'])

            const [result, err] = await repo.list('')
            expect(err).toBeNull()
            expect(result!.taskEntities.map((task) => task.name)).toContain('回退任务')
            expect(list).toHaveBeenCalled()

            const [fetched, fetchErr] = await repo.get(created.id)
            expect(fetchErr).toBeNull()
            expect(fetched!.name).toBe('回退任务')
        }
    })

    it('凭证结构信号（HTTP 401 / 业务码 10041）⇒ 上抛，不得用镜像掩盖', async () => {
        const credentialCases = [
            makeThrownHttpError(401, 'ERR_BAD_REQUEST'),
            Object.assign(new Error('用户凭证验证失败'), { code: 10041 })
        ]

        for (const thrown of credentialCases) {
            const mirror = newLocalTaskRepository()
            const mirrorList = vi.spyOn(mirror, 'list')
            const { remote } = makeRemote(thrown)
            const repo = withMirrorFallback<TaskRepository>(remote, mirror, ['get', 'list'])

            await expect(repo.list('')).rejects.toThrow()
            expect(mirrorList).not.toHaveBeenCalled()
        }
    })

    it('未知 / 无 code 异常 ⇒ 回退镜像（fail-soft）', async () => {
        const mirror = newLocalTaskRepository()
        const { remote } = makeRemote(new Error('未知异常'))
        const repo = withMirrorFallback<TaskRepository>(remote, mirror, ['get', 'list'])

        const [result, err] = await repo.list('')
        expect(err).toBeNull()
        expect(result!.taskEntities).toEqual([])
    })
})

describe('isNormalizedNetworkError - 网络类判据（requester 归一化产物）', () => {
    it('断网/超时/限流三文案 ⇒ 网络类', () => {
        for (const { message } of NORMALIZED_NETWORK_ERRORS) {
            expect(isNormalizedNetworkError(message)).toBe(true)
        }
    })

    it('业务/凭证/空值/近似文案 ⇒ 非网络类（不得误判）', () => {
        expect(isNormalizedNetworkError('任务不存在')).toBe(false)
        expect(isNormalizedNetworkError('用户凭证验证失败')).toBe(false)
        expect(isNormalizedNetworkError(null)).toBe(false)
        expect(isNormalizedNetworkError('网络错误')).toBe(false)
    })
})

describe('withMirrorFallback - 归一化网络错误元组（DEF-21 生产形态）', () => {
    beforeEach(async () => {
        await setup()
    })

    it.each(NORMALIZED_NETWORK_ERRORS)(
        '真实 TaskRepoImpl 收到归一化 $code 响应 ⇒ 回退本地镜像，err 为 null',
        async ({ code, message, bizCode }) => {
            const { mirror, created } = await seedMirror('离线任务')
            const response = { code, data: { data: null, message, code: bizCode } }
            const repo = withMirrorFallback<TaskRepository>(makeRealRemote(response), mirror, [
                'get',
                'list'
            ])

            const [result, listErr] = await repo.list('')
            expect(listErr).toBeNull()
            expect(result!.taskEntities.map((task) => task.name)).toContain('离线任务')

            const [fetched, fetchErr] = await repo.get(created.id)
            expect(fetchErr).toBeNull()
            expect(fetched!.name).toBe('离线任务')
        }
    )

    it('远端已应答的业务失败元组 ⇒ 不回退镜像，错误原样透出', async () => {
        const { mirror } = await seedMirror('不应被读到的镜像')
        const mirrorList = vi.spyOn(mirror, 'list')
        const remote = makeRealRemote({
            data: { code: 40400, message: '任务不存在', data: null }
        })
        const repo = withMirrorFallback<TaskRepository>(remote, mirror, ['get', 'list'])

        const [result, err] = await repo.list('')
        expect(result).toBeNull()
        expect(err).toBe('任务不存在')
        expect(mirrorList).not.toHaveBeenCalled()
    })

    it('凭证失败元组（10041）⇒ 不回退镜像，错误原样透出（不用镜像掩盖）', async () => {
        const { mirror } = await seedMirror('不应被读到的镜像')
        const mirrorList = vi.spyOn(mirror, 'list')
        const remote = makeRealRemote({
            data: { code: 10041, message: '用户凭证验证失败', data: null }
        })
        const repo = withMirrorFallback<TaskRepository>(remote, mirror, ['get', 'list'])

        const [result, err] = await repo.list('')
        expect(result).toBeNull()
        expect(err).toBe('用户凭证验证失败')
        expect(mirrorList).not.toHaveBeenCalled()
    })
})

describe('withMirrorFallback - 真实 AxiosRequester 归一化（端到端）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('真实请求器把 ERR_NETWORK 归一化为 resolve ⇒ 判据命中真实产物并回退镜像', async () => {
        const { mirror, created } = await seedMirror('端到端离线任务')
        const requester = initRequester({
            name: 'AxiosRequester',
            baseURL: 'http://offline.test',
            enableRetry: false
        })
        Object.assign(requester._instance!.defaults, {
            adapter: async () => {
                throw Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
            }
        })

        // 钉死「判据 ↔ requester 产物」：真实拦截器产出的归一化文案必被判定为网络类
        const raw = await requester.get('/tasks/')
        expect(raw).toMatchObject({
            code: 'ERR_NETWORK',
            data: { message: '网络错误，请检查您的网络连接', code: 50300 }
        })
        expect(isNormalizedNetworkError((raw.data as { message: string }).message)).toBe(true)

        const repo = withMirrorFallback<TaskRepository>(new TaskRepoImpl(requester), mirror, [
            'get',
            'list'
        ])

        const [result, err] = await repo.list('')
        expect(err).toBeNull()
        expect(result!.taskEntities.map((task) => task.name)).toContain('端到端离线任务')

        const [fetched, fetchErr] = await repo.get(created.id)
        expect(fetchErr).toBeNull()
        expect(fetched!.name).toBe('端到端离线任务')
    })
})