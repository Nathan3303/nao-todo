// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPinia, setActivePinia } from 'pinia'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { useUserStore } from '@nao-todo/presentation-identity'
import { grantOfflineEntry, revokeOfflineEntry } from './offline-entry'

/**
 * auth 守卫（beforeEnter）离线进入断言（SHELL-03 附录 B-2 / C-62 判据替换）
 * @description 条件④ `cryptoService.isUnlocked` 已删（DEF-16 退役门后恒假）⇒ 新判据
 *              「JWT 可解析 + 会话一致 + **本地镜像存在**」（原因码 `mirror-missing`）。
 *              任一不满足 ⇒ 回落原三分支（在线且 token 无效仍走 signin/checkin）。
 *              **安全回归线**：登出后即使 flag 残留 true，也不得放行 index。
 *              本文件补 qa 未覆盖的**守卫级**接线（镜像探测 API 由实现定名 `hasLocalMirror`）。
 */

const mocks = vi.hoisted(() => ({
    resolveUserIdFromStoredJwt: vi.fn(),
    getCurrentUserId: vi.fn(),
    setCurrentUserId: vi.fn(),
    checkAndCleanExpired: vi.fn(async () => false),
    /** T108 补充：镜像新鲜度从 `meta` 恢复（AC8 首帧） */
    restoreMirrorStatus: vi.fn(async () => undefined),
    /** 本地镜像存在（探测替身：任一表 count > 0） */
    hasLocalMirror: true,
    logStructured: vi.fn()
}))

vi.mock('@nao-todo/infrastructure', () => {
    const mirrorTable = {
        where: () => ({
            equals: () => ({ count: async () => (mocks.hasLocalMirror ? 1 : 0) })
        })
    }
    return {
        resolveUserIdFromStoredJwt: mocks.resolveUserIdFromStoredJwt,
        localSession: {
            getCurrentUserId: mocks.getCurrentUserId,
            setCurrentUserId: mocks.setCurrentUserId
        },
        deletionService: {
            checkAndCleanExpired: mocks.checkAndCleanExpired,
            resumePendingWipe: async () => false
        },
        syncService: { restoreMirrorStatus: mocks.restoreMirrorStatus },
        localDatabase: { syncCursor: mirrorTable, table: () => mirrorTable },
        BUSINESS_TABLES: ['projects', 'tasks'],
        logStructured: mocks.logStructured,
        STRUCTURED_LOG_EVENTS: {
            LIFECYCLE_BOOTSTRAP_STARTED: 'lifecycle.bootstrap.started',
            LIFECYCLE_BOOTSTRAP_COMPLETED: 'lifecycle.bootstrap.completed',
            LIFECYCLE_BOOTSTRAP_FAILED: 'lifecycle.bootstrap.failed'
        }
    }
})

// T122：生产侧已改窄子路径导入 ⇒ 同步注册同名深路径 mock（转发上方 barrel mock，语义不变）
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/session/local-session',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/deletion/deletion-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/sync-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/db/local-database',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/observability/structured-log',
    async () => import('@nao-todo/infrastructure')
)

const { beforeEnter } = await import('./routes')

const setSessionJwt = (jwt: string | null): void => {
    if (jwt === null) localStorage.removeItem(USER_JWT_LOCALSTORAGE_KEY)
    else localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, jwt)
}

describe('auth beforeEnter - C-62 离线进入判据', () => {
    beforeEach(() => {
        localStorage.clear()
        revokeOfflineEntry()
        setActivePinia(createPinia())
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        mocks.getCurrentUserId.mockReturnValue('u-1')
        mocks.hasLocalMirror = true
        mocks.restoreMirrorStatus.mockClear()
    })

    it('C-62 正向（守卫级）：授权 + JWT 可解析 + 会话一致 + 镜像存在 ⇒ 放行 index（门退役后仍可达）', async () => {
        grantOfflineEntry()
        await expect(beforeEnter()).resolves.toBe(true)
    })

    it('C-62 正向：放行同时执行启动收敛点（C-61②：checkAndCleanExpired 以 JWT userId 调用）', async () => {
        grantOfflineEntry()
        await beforeEnter()
        expect(mocks.checkAndCleanExpired).toHaveBeenCalledWith('u-1')
    })

    it('T108/AC8 首帧：离线门放行时从 meta 恢复镜像新鲜度，且**晚于** checkAndCleanExpired（无首帧闪烁）', async () => {
        grantOfflineEntry()
        await beforeEnter()
        expect(mocks.restoreMirrorStatus).toHaveBeenCalledTimes(1)
        // 顺序硬约束：restoreMirrorStatus 依赖 bootstrapLocalData 重建的 localSession
        expect(mocks.checkAndCleanExpired.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.restoreMirrorStatus.mock.invocationCallOrder[0]!
        )
    })

    it('T108/AC8 首帧：已认证在线放行分支同样恢复镜像新鲜度', async () => {
        setSessionJwt('jwt')
        useUserStore().setIsAuthenticated(true)
        await beforeEnter()
        expect(mocks.restoreMirrorStatus).toHaveBeenCalledTimes(1)
    })

    it('① 未授权 ⇒ 回落三分支（有 JWT 未认证 ⇒ checkin）', async () => {
        setSessionJwt('jwt')
        await expect(beforeEnter()).resolves.toEqual({ name: 'auth-checkin' })
    })

    it('安全回归线：登出后即使 flag 残留 true（JWT 已清）⇒ 仍不放行 index（走 signin）', async () => {
        grantOfflineEntry()
        mocks.resolveUserIdFromStoredJwt.mockReturnValue(null)
        setSessionJwt(null)
        await expect(beforeEnter()).resolves.toEqual({ name: 'auth-signin' })
    })

    it('② 有 flag 但 JWT 不可解析（token 无效）⇒ 回落 checkin（在线无效 token 不得进壳）', async () => {
        grantOfflineEntry()
        setSessionJwt('broken-jwt')
        mocks.resolveUserIdFromStoredJwt.mockReturnValue(null)
        await expect(beforeEnter()).resolves.toEqual({ name: 'auth-checkin' })
    })

    it('③ 内存会话与 JWT 用户不一致 ⇒ 回落 checkin', async () => {
        grantOfflineEntry()
        setSessionJwt('jwt')
        mocks.getCurrentUserId.mockReturnValue('u-2')
        await expect(beforeEnter()).resolves.toEqual({ name: 'auth-checkin' })
    })

    it('④ 本地镜像不存在 ⇒ 回落 checkin（mirror-missing 替换原 locked）', async () => {
        grantOfflineEntry()
        setSessionJwt('jwt')
        mocks.hasLocalMirror = false
        await expect(beforeEnter()).resolves.toEqual({ name: 'auth-checkin' })
    })

    it('已认证（在线正常登录）⇒ 放行 index，与 flag 无关', async () => {
        setSessionJwt('jwt')
        useUserStore().setIsAuthenticated(true)
        await expect(beforeEnter()).resolves.toBe(true)
    })
})