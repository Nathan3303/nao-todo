import 'fake-indexeddb/auto'
import Dexie, { type Table } from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { OperationLog } from '@nao-todo/shared/requester/types'
import {
    createLog,
    listFailedIdempotentLogs,
    listLogs,
    purgeLegacyCredentialLogs,
    shouldSkipOperationLog
} from '@nao-todo/shared/requester/operation-log'
import { replayFailedOperations } from '@nao-todo/shared/requester'

/**
 * T560 / P0-安全：操作日志**永不**持久化凭据
 *
 * @description 旧实现把请求体原样写进 IndexedDB（`nao-todo-operation-log/operationLogs`）
 *              ⇒ `POST /auth/signin {email,password}` 的**明文口令**与账号密码同值落库、
 *              失败/超时后长期保留。本文件钉住三条：
 *              ① 认证接口 / 含凭据字段的请求体**不写日志**（也不留下可重放的记录）；
 *              ② 历史残留（已落库的口令）在初始化时被**一次性清除**；
 *              ③ `replayFailedOperations` 的取数面（`listFailedIdempotentLogs`）**排除**它们
 *                （不得重放登录/检入/登出/改密）。
 *
 * **位置说明**：被测模块在 `@nao-todo/shared/requester/operation-log`，但断言必须打到**真实 IndexedDB**
 * （`nao-todo-operation-log` 库）⇒ 本用例放在 `infrastructure`（唯一具备 `fake-indexeddb` 的测试包），
 * 与被测模块同级的 `shared` 包不引测试依赖。
 */

const DB_NAME = 'nao-todo-operation-log'
const SECRET = 'P@ssw0rd-明文口令'

/** 带 `operationLogs` 表类型的 Dexie（与 `operation-log.ts` 的同名库同结构） */
type LegacyLogDb = Dexie & { operationLogs: Table<OperationLog, string> }

/** 打开同一个 IndexedDB（模拟「旧版本已经写进去的残留」） */
const openLegacyDb = (): LegacyLogDb => {
    const legacyDb = new Dexie(DB_NAME) as LegacyLogDb
    legacyDb.version(1).stores({ operationLogs: 'id, status' })
    return legacyDb
}

const seedLegacyLogs = async (records: OperationLog[]): Promise<void> => {
    const legacyDb = openLegacyDb()
    await legacyDb.operationLogs.bulkAdd(records)
    legacyDb.close()
}

const makeLog = (id: string, overrides: Partial<OperationLog> = {}): OperationLog => ({
    id,
    method: 'post',
    url: '/auth/signin',
    data: { email: 'user@example.com', password: SECRET },
    status: 'failed',
    createdAt: Date.now(),
    retryCount: 0,
    ...overrides
})

beforeEach(async () => {
    await seedLegacyLogs([])
    // 清空（`purgeLegacyCredentialLogs` 只删凭据类；这里做全表复位）
    const db = openLegacyDb()
    await db.operationLogs.clear()
    db.close()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('shouldSkipOperationLog - 凭据红线判据', () => {
    it('认证接口一律跳过（signin/signup/checkin/signout）', () => {
        expect(shouldSkipOperationLog('/auth/signin', { email: 'a@b.c' })).toBe(true)
        expect(shouldSkipOperationLog('/auth/signup', { email: 'a@b.c' })).toBe(true)
        expect(shouldSkipOperationLog('/auth/checkin', {})).toBe(true)
        expect(shouldSkipOperationLog('/auth/signout', undefined)).toBe(true)
        // 带前缀 / 查询串 / 大小写仍命中
        expect(shouldSkipOperationLog('/api/auth/signin?x=1', {})).toBe(true)
        expect(shouldSkipOperationLog('/AUTH/checkin', {})).toBe(true)
    })

    it('请求体含凭据字段（任意深度 / 数组 / 命名变体）一律跳过', () => {
        expect(
            shouldSkipOperationLog('/user/password', { oldPassword: 'a', newPassword: 'b' })
        ).toBe(true)
        expect(shouldSkipOperationLog('/tasks', { nested: { token: 'jwt-x' } })).toBe(true)
        expect(shouldSkipOperationLog('/tasks', [{ title: 'x' }, { JWT: 'jwt-x' }])).toBe(true)
        expect(shouldSkipOperationLog('/tasks', { authorization: 'Bearer x' })).toBe(true)
        expect(shouldSkipOperationLog('/tasks', { refresh_token: 'x' })).toBe(true)
    })

    it('普通业务请求不跳过', () => {
        expect(shouldSkipOperationLog('/tasks', { title: '写周报' })).toBe(false)
        expect(shouldSkipOperationLog('/sync/pull', { tasks: { updatedAt: null } })).toBe(false)
    })
})

describe('createLog - 凭据请求不落库', () => {
    it('signin（含明文口令）⇒ 不写日志，IndexedDB 内**无** password 字段/记录', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const id = await createLog('post', '/auth/signin', {
            email: 'user@example.com',
            password: SECRET
        })

        expect(id).toBeNull()
        const logs = await listLogs()
        expect(logs).toHaveLength(0)
        expect(JSON.stringify(logs)).not.toContain(SECRET)
        expect(JSON.stringify(logs)).not.toContain('password')
        warn.mockRestore()
    })

    it('改密（/user/password，非 /auth 前缀）⇒ 按请求体凭据字段跳过', async () => {
        const id = await createLog('put', '/user/password', {
            oldPassword: SECRET,
            newPassword: `${SECRET}-new`
        })

        expect(id).toBeNull()
        expect(await listLogs()).toHaveLength(0)
    })

    it('普通业务请求照常记录，且记录里没有凭据字段', async () => {
        const id = await createLog('post', '/tasks', { title: '写周报', done: false })

        expect(id).not.toBeNull()
        const logs = await listLogs()
        expect(logs).toHaveLength(1)
        expect(logs[0]?.url).toBe('/tasks')
        expect(JSON.stringify(logs)).not.toContain('password')
        expect(JSON.stringify(logs)).not.toContain(SECRET)
    })
})

describe('purgeLegacyCredentialLogs - 历史残留一次性清理', () => {
    it('扫描并删除含凭据的旧记录，保留干净记录', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        await seedLegacyLogs([
            makeLog('legacy-signin'),
            makeLog('legacy-checkin', {
                method: 'put',
                url: '/auth/checkin',
                data: { jwt: 'jwt-old' }
            }),
            makeLog('legacy-password', {
                method: 'put',
                url: '/user/password',
                data: { oldPassword: SECRET }
            }),
            makeLog('keep-task', { url: '/tasks', data: { title: '写周报' } })
        ])

        const purged = await purgeLegacyCredentialLogs()

        expect(purged).toBe(3)
        const remaining = await listLogs()
        expect(remaining.map((log) => log.id)).toEqual(['keep-task'])
        expect(JSON.stringify(remaining)).not.toContain(SECRET)
        expect(JSON.stringify(remaining)).not.toContain('JWT')
        warn.mockRestore()
    })

    it('无残留 ⇒ 幂等零删除', async () => {
        await seedLegacyLogs([makeLog('keep-task', { url: '/tasks', data: { title: 'x' } })])

        expect(await purgeLegacyCredentialLogs()).toBe(0)
        expect(await listLogs()).toHaveLength(1)
    })
})

describe('replayFailedOperations - 不重放凭据请求', () => {
    it('取数面排除凭据记录；replay 只处理干净记录', async () => {
        await seedLegacyLogs([
            makeLog('legacy-signin'),
            makeLog('legacy-password', {
                method: 'put',
                url: '/user/password',
                data: { newPassword: SECRET }
            }),
            makeLog('retry-task', { method: 'put', url: '/tasks/1', data: { title: 'x' } })
        ])

        // ① replay 的取数面（唯一入口）不含任何凭据记录
        const candidates = await listFailedIdempotentLogs()
        expect(candidates.map((log) => log.id)).toEqual(['retry-task'])

        // ② 真跑 replay：干净记录被处理（空请求器返回非字符串 code ⇒ 视为成功并删除）；
        //    凭据记录**未被派发**（仍留在库中，等 purge 清理）
        await replayFailedOperations()

        const remaining = await listLogs()
        expect(remaining.map((log) => log.id).sort()).toEqual(['legacy-password', 'legacy-signin'])
    })
})