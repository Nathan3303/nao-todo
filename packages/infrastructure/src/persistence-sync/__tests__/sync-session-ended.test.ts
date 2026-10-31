import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared/requester/types'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { SyncService } from '../sync-service'

/**
 * node 环境无 `localStorage` ⇒ 注入最小内存实现（本文件只依赖 get/set/remove/clear）
 * @description 走 node 环境是为了复用 `fake-indexeddb/auto` 的既有桥接方式
 *              （jsdom 下 fake-indexeddb 只挂 `window`，与 Dexie 捕获的 `globalThis` 不同一对象）。
 */
const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => void memory.set(key, value),
        removeItem: (key: string) => void memory.delete(key),
        clear: () => memory.clear()
    }
})

/**
 * T589 红基线 —— AC6 会话结束后后台同步零请求、零 `Bearer null`（`DEF-93`，ADR D6）
 *
 * 缺陷现场：`authHeaders()` 为
 *   `{ Authorization: `Bearer ${getJWTFromLocalStorage()}` }`
 * 而 `getJWTFromLocalStorage()` 在会话已结束时返回 **`null`** ⇒ 请求头 `Bearer null`
 * ⇒ 后台同步继续发请求并收 `10041` 噪音。
 *
 * 判据（ADR D6）：
 * - `authHeaders()` 无 token ⇒ **`{}`**（永不 `Bearer null`）；
 * - 会话结束后（JWT 已清）`pullAll()` 不发网络请求；
 * - 有 token 时仍正常发请求且头为 `Bearer <jwt>`（证明「零请求」不是恒零）。
 *
 * 状态：**红**（无 token 仍发请求，且头为 `Bearer null`）。
 * 变异易感：恢复模板拼接 ⇒ 红；把早退门删掉 ⇒ 红。
 */

const USER_ID = 'u-589'

const makeRequester = (): Requester & { calls: { headers: Record<string, string> }[] } => {
    const calls: { headers: Record<string, string> }[] = []
    const respond = async (_url: string, _body?: unknown, config?: unknown) => {
        const headers = ((config as { headers?: Record<string, string> })?.headers ?? {}) as Record<
            string,
            string
        >
        calls.push({ headers })
        // 业务码 10041 ⇒ 本轮终止（只验证「是否发出 / 头部内容」）
        return { data: { code: 10041 } }
    }
    return {
        _instance: null,
        name: 'AxiosRequester',
        baseURL: 'https://api.example.test',
        get: respond as Requester['get'],
        post: respond as Requester['post'],
        put: respond as Requester['put'],
        delete: respond as Requester['delete'],
        calls
    }
}

const headersOf = (service: SyncService): Record<string, string> =>
    (service as unknown as { authHeaders: () => Record<string, string> }).authHeaders()

beforeEach(async () => {
    localStorage.clear()
    await localDatabase.syncCursor.clear()
    await localDatabase.syncQueue.clear()
    localSession.setCurrentUserId(USER_ID)
})

describe('AC6：authHeaders 无 token ⇒ {}（永不 Bearer null）', () => {
    it('无 token ⇒ 不返回 Authorization 头', () => {
        const headers = headersOf(new SyncService(makeRequester()))

        expect(headers).toEqual({})
        expect(JSON.stringify(headers)).not.toContain('null')
    })

    it('有 token ⇒ Bearer <jwt>（正向对照）', () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-589')

        const headers = headersOf(new SyncService(makeRequester()))

        expect(headers.Authorization).toBe('Bearer jwt-589')
    })
})

describe('AC6：会话结束后后台同步零请求', () => {
    it('JWT 已清（会话结束）⇒ pullAll 不发任何请求', async () => {
        const requester = makeRequester()
        const service = new SyncService(requester)

        await service.pullAll()

        expect(requester.calls, '会话结束后的后台同步必须早退').toEqual([])
    })

    it('有 token ⇒ 正常发请求，且任何请求头都不含 `Bearer null`', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-589')
        const requester = makeRequester()
        const service = new SyncService(requester)

        await service.pullAll()

        expect(requester.calls.length).toBeGreaterThan(0)
        const headers = requester.calls.map((call) => call.headers.Authorization ?? '')
        expect(headers.every((value) => !value.endsWith('null'))).toBe(true)
    })
})