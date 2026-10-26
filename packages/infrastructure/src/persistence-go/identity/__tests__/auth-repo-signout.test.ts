import { describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { useAuthRepository } from '../auth-repo-impl/impl'

/**
 * T560 / P1：登出（撤销服务端会话）契约
 *
 * @description 服务端契约（rd-be 双侧实测）：请求体字段名 = **`jwt`**（不是 `token`）；
 *              成功码 = **`10030`**；`10031` = **参数错误**。
 *              旧实现 ① 发 `{ token }` ⇒ 服务端 10031；② 把 `10031` 当成功 ⇒ **会话从未撤销**，
 *              只清了本地 token。本文件钉住「成功 10030 / 10031 视为失败」。
 */

const requesterWith = (deleteFn: () => Promise<unknown>): Requester =>
    ({
        delete: deleteFn,
        get: async () => ({ data: {} }),
        post: async () => ({ data: {} }),
        put: async () => ({ data: {} })
    }) as unknown as Requester

const signOutRepo = (deleteFn: () => Promise<unknown>) => useAuthRepository(requesterWith(deleteFn))

describe('AuthRepository.signOut - 服务端会话撤销契约', () => {
    it('请求体字段名是 `jwt`（不是 `token`），删除方式为 DELETE 且体在 config.data', async () => {
        const deleteFn = vi.fn(async () => ({
            data: { code: 10030, message: '登出成功', data: null }
        }))
        const repo = signOutRepo(deleteFn)

        const err = await repo.signOut('jwt-abc')

        expect(err).toBeNull()
        expect(deleteFn).toHaveBeenCalledTimes(1)
        const [url, config] = deleteFn.mock.calls[0] as unknown as [
            string,
            { data?: Record<string, unknown> }
        ]
        expect(url).toBe('/auth/signout')
        expect(config.data).toEqual({ jwt: 'jwt-abc' })
        expect(config.data).not.toHaveProperty('token')
    })

    it('10031（参数错误）视为**失败**（不得当成功 ⇒ 旧实现会话未撤销）', async () => {
        const repo = signOutRepo(async () => ({
            data: { code: 10031, message: '参数错误' }
        }))

        const err = await repo.signOut('jwt-abc')

        expect(err).not.toBeNull()
        expect(err).toBeInstanceOf(Error)
        const failure = err as Error & { businessCode?: number; code?: string | number }
        expect(failure.message).toBe('参数错误')
        expect(failure.businessCode).toBe(10031)
        expect(failure.code).toBe(10031)
    })

    it('响应缺失（null）也按失败处理（不得静默成功）', async () => {
        const repo = signOutRepo(async () => ({ data: null }))

        const err = await repo.signOut('jwt-abc')

        expect(err).toBeInstanceOf(Error)
    })

    it('网络类归一化失败（顶层字符串 code + 50300）⇒ 失败信息带 code（供「不弹错误」分类）', async () => {
        const repo = signOutRepo(async () => ({
            code: 'ERR_NETWORK',
            data: { data: null, code: 50300, message: '网络错误，请检查您的网络连接' }
        }))

        const err = await repo.signOut('jwt-abc')

        const failure = err as Error & { code?: string | number; businessCode?: number }
        expect(failure).toBeInstanceOf(Error)
        // 顶层归一化 code 优先（`isNetworkError` 据此静默）
        expect(failure.code).toBe('ERR_NETWORK')
        expect(failure.businessCode).toBe(50300)
    })
})