import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises } from '@vue/test-utils'
import { bootstrapLocalData, withBootstrapRetry } from './bootstrap-local-data'

/**
 * C-61 / DEF-10：启动收敛点与常驻重跑（调用点①②③）
 * @description `bootstrapLocalData` 为「JWT → 本地会话重建 + 注销到期清理」唯一收敛点；
 *              必须早于 `syncService.start()`（顺序断言见 desktop `def10-bootstrap-order.test.ts`）。
 *              `withBootstrapRetry` 挂既有回传触发源（online / 前台恢复），不新增定时器。
 */

const mocks = vi.hoisted(() => ({
    resolveUserIdFromStoredJwt: vi.fn(),
    setCurrentUserId: vi.fn(),
    checkAndCleanExpired: vi.fn(async () => false),
    resumePendingWipe: vi.fn(async () => false),
    handleOnline: vi.fn(),
    handleVisibility: vi.fn(),
    logStructured: vi.fn()
}))

vi.mock('@nao-todo/infrastructure', () => ({
    resolveUserIdFromStoredJwt: mocks.resolveUserIdFromStoredJwt,
    localSession: { setCurrentUserId: mocks.setCurrentUserId },
    deletionService: {
        checkAndCleanExpired: mocks.checkAndCleanExpired,
        resumePendingWipe: mocks.resumePendingWipe
    },
    logStructured: mocks.logStructured,
    STRUCTURED_LOG_EVENTS: {
        LIFECYCLE_BOOTSTRAP_STARTED: 'lifecycle.bootstrap.started',
        LIFECYCLE_BOOTSTRAP_COMPLETED: 'lifecycle.bootstrap.completed',
        LIFECYCLE_BOOTSTRAP_FAILED: 'lifecycle.bootstrap.failed'
    }
}))

// T122：生产侧已改窄子路径导入 ⇒ 同步注册同名深路径 mock（转发上方 barrel mock，语义不变）
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/deletion/deletion-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/session/local-session',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/observability/structured-log',
    async () => import('@nao-todo/infrastructure')
)

beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
})

describe('bootstrapLocalData - C-61 启动收敛点', () => {
    it('无参：JWT 解析 userId → 重建本地会话 → 清理到期数据', async () => {
        await bootstrapLocalData()
        expect(mocks.resolveUserIdFromStoredJwt).toHaveBeenCalledTimes(1)
        expect(mocks.setCurrentUserId).toHaveBeenCalledWith('u-1')
        expect(mocks.checkAndCleanExpired).toHaveBeenCalledWith('u-1')
    })

    it('C-53：每次启动先补完遗留清库（resumePendingWipe），且先于会话重建', async () => {
        const order: string[] = []
        mocks.resumePendingWipe.mockImplementation(async () => {
            order.push('resumePendingWipe')
            return false
        })
        mocks.setCurrentUserId.mockImplementation(() => {
            order.push('setCurrentUserId')
        })
        await bootstrapLocalData()
        expect(mocks.resumePendingWipe).toHaveBeenCalledTimes(1)
        expect(order[0]).toBe('resumePendingWipe')
    })

    it('显式 userId 优先，不再解析 JWT', async () => {
        await bootstrapLocalData('u-9')
        expect(mocks.resolveUserIdFromStoredJwt).not.toHaveBeenCalled()
        expect(mocks.setCurrentUserId).toHaveBeenCalledWith('u-9')
        expect(mocks.checkAndCleanExpired).toHaveBeenCalledWith('u-9')
    })

    it('C-55：无 JWT（未登录）⇒ no-op，不触碰本地会话与到期清理', async () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue(null)
        await bootstrapLocalData()
        expect(mocks.setCurrentUserId).not.toHaveBeenCalled()
        expect(mocks.checkAndCleanExpired).not.toHaveBeenCalled()
    })

    it('C-55：空串 userId 亦 no-op（不得退化为空用户读写）', async () => {
        await bootstrapLocalData('')
        expect(mocks.setCurrentUserId).not.toHaveBeenCalled()
        expect(mocks.checkAndCleanExpired).not.toHaveBeenCalled()
    })
})

describe('withBootstrapRetry - C-61 调用点③（常驻跨 7 天）', () => {
    it('online / 前台恢复：原目标触发 + 各重跑一次收敛点', async () => {
        const target = withBootstrapRetry({
            handleOnline: mocks.handleOnline,
            handleVisibility: mocks.handleVisibility
        })

        target.handleOnline()
        target.handleVisibility()
        await flushPromises()

        expect(mocks.handleOnline).toHaveBeenCalledTimes(1)
        expect(mocks.handleVisibility).toHaveBeenCalledTimes(1)
        expect(mocks.checkAndCleanExpired).toHaveBeenCalledTimes(2)
    })
})

describe('AC18 - 启动路径结构化日志（禁 PII；单一真源 ⇒ 两端覆盖）', () => {
    it('成功路径：started（是否显式 userId）→ completed（hasSession=true）', async () => {
        await bootstrapLocalData()
        expect(mocks.logStructured).toHaveBeenCalledWith('info', 'lifecycle.bootstrap.started', {
            hasExplicitUserId: false
        })
        expect(mocks.logStructured).toHaveBeenCalledWith('info', 'lifecycle.bootstrap.completed', {
            hasExplicitUserId: false,
            hasSession: true
        })
    })

    it('无 JWT（未登录）：completed 仍落，但 hasSession=false', async () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue(null)
        await bootstrapLocalData()
        expect(mocks.logStructured).toHaveBeenCalledWith('info', 'lifecycle.bootstrap.completed', {
            hasExplicitUserId: false,
            hasSession: false
        })
    })

    it('异常路径：落 failed（仅错误名）+ 错误继续上抛（不吞）', async () => {
        const failure = Object.assign(new Error('boom'), { name: 'StorageError' })
        mocks.resumePendingWipe.mockRejectedValueOnce(failure)
        await expect(bootstrapLocalData()).rejects.toBe(failure)
        expect(mocks.logStructured).toHaveBeenCalledWith('error', 'lifecycle.bootstrap.failed', {
            hasExplicitUserId: false,
            errorName: 'StorageError'
        })
    })

    it('禁 PII：日志字段不含 userId / token / 正文', async () => {
        await bootstrapLocalData()
        const serialized = JSON.stringify(mocks.logStructured.mock.calls)
        expect(serialized).not.toContain('u-1')
        expect(serialized.toLowerCase()).not.toContain('token')
    })

    it('顺序不变：resumePendingWipe → 会话重建 → checkAndCleanExpired', async () => {
        const order: string[] = []
        mocks.resumePendingWipe.mockImplementationOnce(async () => {
            order.push('resumePendingWipe')
            return false
        })
        mocks.setCurrentUserId.mockImplementationOnce(() => {
            order.push('setCurrentUserId')
        })
        mocks.checkAndCleanExpired.mockImplementationOnce(async () => {
            order.push('checkAndCleanExpired')
            return false
        })
        await bootstrapLocalData()
        expect(order).toEqual(['resumePendingWipe', 'setCurrentUserId', 'checkAndCleanExpired'])
    })
})