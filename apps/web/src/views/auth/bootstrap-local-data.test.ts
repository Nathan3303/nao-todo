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
    handleVisibility: vi.fn()
}))

vi.mock('@nao-todo/infrastructure', () => ({
    resolveUserIdFromStoredJwt: mocks.resolveUserIdFromStoredJwt,
    localSession: { setCurrentUserId: mocks.setCurrentUserId },
    deletionService: {
        checkAndCleanExpired: mocks.checkAndCleanExpired,
        resumePendingWipe: mocks.resumePendingWipe
    }
}))

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