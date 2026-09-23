import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

/**
 * web 数据面运行接线（C-66 / AC8 / AC9）
 * @description 校验：无 JWT 不启动；同一用户只启动一次；切换账号重拉；回传触发源只注册一次。
 *              真正的镜像读取回退语义由 `packages/infrastructure/src/persistence-go/fallback/__tests__`
 *              覆盖（本文件只锁「web 也用 syncService」的接线行为）。
 */

const mocks = vi.hoisted(() => ({
    start: vi.fn(async () => ({ ok: true })),
    unregister: vi.fn(),
    registerBackfillTriggers: vi.fn(),
    resolveUserIdFromStoredJwt: vi.fn(),
    withBootstrapRetry: vi.fn((target: unknown) => target),
    mirrorPulledAt: null as string | null,
    mirrorTruncated: false
}))

vi.mock('@nao-todo/infrastructure', () => ({
    registerBackfillTriggers: mocks.registerBackfillTriggers,
    resolveUserIdFromStoredJwt: mocks.resolveUserIdFromStoredJwt,
    syncService: { start: mocks.start },
    syncStatus: {
        get: () => ({
            mirrorPulledAt: mocks.mirrorPulledAt,
            mirrorTruncated: mocks.mirrorTruncated
        })
    }
}))

// T122：生产侧已改窄子路径导入 ⇒ 同步注册同名深路径 mock（转发上方 barrel mock，语义不变）
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/backfill-triggers',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/session/local-session',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/sync-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/sync-status',
    async () => import('@nao-todo/infrastructure')
)
// TASK-26 / M6：偏好同步接线（本文件只锁数据面接线行为，偏好模块单独单测覆盖）
vi.mock('@nao-todo/infrastructure/src/persistence-sync/preference-sync', () => ({
    flushPreferenceQueue: vi.fn(async () => ({ pushed: 0, failed: 0 })),
    pullAndMergeUserConfig: vi.fn(async () => {})
}))

vi.mock('@/views/auth/bootstrap-local-data', () => ({
    withBootstrapRetry: mocks.withBootstrapRetry
}))

const { startWebDataPlane, resetWebDataPlaneForTest, getMirrorState } = await import('./data-plane')

describe('startWebDataPlane - C-66 web 数据面接线', () => {
    beforeEach(() => {
        resetWebDataPlaneForTest()
        vi.clearAllMocks()
        mocks.registerBackfillTriggers.mockReturnValue(mocks.unregister)
    })

    it('无 JWT（未登录）⇒ 不启动同步；回传触发源仍注册一次（供后续登录触发）', () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue(null)
        startWebDataPlane()
        expect(mocks.start).not.toHaveBeenCalled()
        expect(mocks.registerBackfillTriggers).toHaveBeenCalledTimes(1)
    })

    it('有 JWT ⇒ 注册回传触发源一次并后台启动同步', () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        startWebDataPlane()
        expect(mocks.registerBackfillTriggers).toHaveBeenCalledTimes(1)
        expect(mocks.withBootstrapRetry).toHaveBeenCalledTimes(1)
        expect(mocks.start).toHaveBeenCalledTimes(1)
    })

    it('同一用户重复调用 ⇒ 只拉一次、触发源只注册一次', () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        startWebDataPlane()
        startWebDataPlane()
        startWebDataPlane()
        expect(mocks.registerBackfillTriggers).toHaveBeenCalledTimes(1)
        expect(mocks.start).toHaveBeenCalledTimes(1)
    })

    it('切换账号 ⇒ 重新拉取（每个用户一次）', () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        startWebDataPlane()
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-2')
        startWebDataPlane()
        expect(mocks.start).toHaveBeenCalledTimes(2)
    })

    it('登出（JWT 清空）⇒ 重置标记；同一用户重新登录后重新拉取', () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        startWebDataPlane()
        // 登出：JWT 已清
        mocks.resolveUserIdFromStoredJwt.mockReturnValue(null)
        startWebDataPlane()
        expect(mocks.start).toHaveBeenCalledTimes(1)
        // 重新登录同一用户
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        startWebDataPlane()
        expect(mocks.start).toHaveBeenCalledTimes(2)
    })

    it('启动失败不抛出（由 syncStatus 暴露，镜像不谎报完整度）', () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        mocks.start.mockResolvedValueOnce({ ok: false, lastError: '网络错误' } as never)
        expect(() => startWebDataPlane()).not.toThrow()
    })
})

describe('getMirrorState - C-60/C-60③ 数据面新鲜度', () => {
    beforeEach(() => {
        mocks.mirrorPulledAt = null
        mocks.mirrorTruncated = false
    })

    it('未同步完成 ⇒ mirrorPulledAt 为 null、mirrorTruncated 为 false', () => {
        expect(getMirrorState()).toEqual({ mirrorPulledAt: null, mirrorTruncated: false })
    })

    it('完整拉取后 ⇒ mirrorPulledAt 有值（供「数据截至 X」）', () => {
        mocks.mirrorPulledAt = '2026-09-23T07:00:00.000Z'
        expect(getMirrorState()).toEqual({
            mirrorPulledAt: '2026-09-23T07:00:00.000Z',
            mirrorTruncated: false
        })
    })

    it('续拉触顶 ⇒ mirrorTruncated 为 true（供「可能不完整」提示）', () => {
        mocks.mirrorPulledAt = '2026-09-23T07:00:00.000Z'
        mocks.mirrorTruncated = true
        expect(getMirrorState()).toEqual({
            mirrorPulledAt: '2026-09-23T07:00:00.000Z',
            mirrorTruncated: true
        })
    })
})