// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

/**
 * T589 红基线 —— AC3 一次失效事件的清理矩阵一致（ADR D2 + `DEF-90`）
 *
 * 执行单点：`apps/web/src/session-end.ts`（axios / sync / 续期 / 跨标签四路共用，ADR D1）
 *
 * 矩阵判据（单次失效事件，**恰好一次**）：
 * | 项 | 期望 |
 * | :-- | :-- |
 * | 会话凭证（JWT + store + 离线授权 + 轮换窗） | 清 ⇒ `clearAuthData` / `localSession.clear` / `revokeOfflineEntry` / `resetTokenRotation` 各 1 |
 * | 内存 DEK | 锁 ⇒ `cryptoService.lock` 1 |
 * | 本地业务数据（11 表） | **留** ⇒ `wipeUserData` 0、`localStorage.clear` 0 |
 * | `key-bundle`（meta） | **留** ⇒ meta 删除 0 |
 * | 导航 | 回登录页 1 次 |
 *
 * 状态：**红**（模块尚未创建）。
 * 变异易感：删 `lock()` ⇒ 红；塞 `wipeUserData` ⇒ 红；去掉 `resetTokenRotation` ⇒ 红。
 */

const SPECIFIER = '../session-end'

const mocks = vi.hoisted(() => ({
    clearAuthData: vi.fn(),
    clearSession: vi.fn(),
    lock: vi.fn(),
    revokeOfflineEntry: vi.fn(),
    resetTokenRotation: vi.fn(),
    safeReplace: vi.fn(async () => true),
    replace: vi.fn(async () => undefined),
    push: vi.fn(async () => undefined),
    wipeUserData: vi.fn(),
    wipeLocalDataOnSignOut: vi.fn(),
    metaDelete: vi.fn(),
    logStructured: vi.fn()
}))

vi.mock('@nao-todo/presentation-identity', () => ({
    useUserStore: () => ({ clearAuthData: mocks.clearAuthData })
}))

vi.mock('vue-router', () => ({
    useRouter: () => ({ replace: mocks.replace, push: mocks.push })
}))

vi.mock('@nao-todo/infrastructure/src/persistence-local/crypto/crypto-service', () => ({
    cryptoService: { lock: mocks.lock }
}))
vi.mock('@nao-todo/infrastructure/src/persistence-local/session/local-session', () => ({
    localSession: { clear: mocks.clearSession }
}))
vi.mock('@nao-todo/infrastructure/src/persistence-local/deletion/deletion-service', () => ({
    deletionService: { wipeUserData: mocks.wipeUserData }
}))
vi.mock('@nao-todo/infrastructure/src/persistence-local/db/local-database', () => ({
    localDatabase: { meta: { delete: mocks.metaDelete, bulkDelete: mocks.metaDelete } }
}))
vi.mock('@nao-todo/infrastructure/src/observability/structured-log', () => ({
    logStructured: mocks.logStructured,
    STRUCTURED_LOG_EVENTS: {}
}))
vi.mock('@nao-todo/infrastructure', () => ({
    cryptoService: { lock: mocks.lock },
    localSession: { clear: mocks.clearSession },
    deletionService: { wipeUserData: mocks.wipeUserData },
    localDatabase: { meta: { delete: mocks.metaDelete, bulkDelete: mocks.metaDelete } },
    logStructured: mocks.logStructured
}))

vi.mock('@/views/auth/offline-entry', () => ({
    revokeOfflineEntry: mocks.revokeOfflineEntry
}))
vi.mock('@/views/auth/sign-out-wipe', () => ({
    wipeLocalDataOnSignOut: mocks.wipeLocalDataOnSignOut
}))
vi.mock('@/safe-navigation', () => ({
    safeReplace: mocks.safeReplace,
    safeReplaceDeepLink: mocks.safeReplace
}))
vi.mock('@nao-todo/shared/requester/auth-rotation', () => ({
    resetTokenRotation: mocks.resetTokenRotation
}))
vi.mock('../offline-read-only', () => ({ revokeOfflineEntry: mocks.revokeOfflineEntry }))

type SessionEndModule = { handleSessionEnd: (reason?: string) => Promise<void> | void }

/** 缺实现装载器 */
const load = async (ac: string): Promise<SessionEndModule> => {
    let mod: Record<string, unknown>
    try {
        mod = (await import(/* @vite-ignore */ SPECIFIER)) as Record<string, unknown>
    } catch (error) {
        throw new Error(
            `[缺实现] 期望模块 apps/web/src/session-end.ts（${ac}）：${(error as Error).message}`
        )
    }
    const handler = mod.handleSessionEnd ?? mod.default
    if (typeof handler !== 'function') {
        throw new Error(
            `[缺实现] apps/web/src/session-end.ts 需导出 handleSessionEnd(reason)（${ac}）`
        )
    }
    return { handleSessionEnd: handler as SessionEndModule['handleSessionEnd'] }
}

describe('AC3：单次失效事件 = 一套清理动作（矩阵一致）', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        localStorage.setItem('nao.deviceId', 'device-sentinel')
    })

    it('清：store / 会话 / 离线授权 / 轮换窗 / 锁 DEK 各 1 次', async () => {
        const { handleSessionEnd } = await load('AC3')

        await handleSessionEnd('expired')

        expect(mocks.clearAuthData).toHaveBeenCalledTimes(1)
        expect(mocks.clearSession).toHaveBeenCalledTimes(1)
        expect(mocks.revokeOfflineEntry).toHaveBeenCalledTimes(1)
        expect(mocks.resetTokenRotation).toHaveBeenCalledTimes(1)
        expect(mocks.lock).toHaveBeenCalledTimes(1)
    })

    it('留：业务数据 11 表 / key-bundle / localStorage 业务键 0 删除', async () => {
        const { handleSessionEnd } = await load('AC3')

        await handleSessionEnd('expired')

        expect(mocks.wipeUserData).not.toHaveBeenCalled()
        expect(mocks.wipeLocalDataOnSignOut).not.toHaveBeenCalled()
        expect(mocks.metaDelete, 'key-bundle 唯一不可逆开关（C-51）不得删').not.toHaveBeenCalled()
        expect(localStorage.getItem('nao.deviceId')).toBe('device-sentinel')
    })

    it('导航：回登录页 1 次（replace/push 合计）', async () => {
        const { handleSessionEnd } = await load('AC3')

        await handleSessionEnd('expired')

        const navigations =
            mocks.replace.mock.calls.length +
            mocks.push.mock.calls.length +
            mocks.safeReplace.mock.calls.length
        expect(navigations).toBe(1)
        const target = [
            ...mocks.replace.mock.calls,
            ...mocks.push.mock.calls,
            ...mocks.safeReplace.mock.calls
        ].flat()
        expect(JSON.stringify(target)).toContain('/auth/signin')
    })
})