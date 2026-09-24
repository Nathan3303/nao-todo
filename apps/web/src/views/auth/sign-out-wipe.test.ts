// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { wipeLocalDataOnSignOut } from './sign-out-wipe'

/**
 * C-54 / C-52：登出清库护栏（脏队列阻塞确认 + `wipeUserData` 单一入口）
 * @description 权威口径 `syncTracker.countDirty(userId)`；`>0` ⇒ 阻塞确认（N + 先同步）
 *              ⇒ 同步后仍 >0 ⇒ 二次确认（明示不可恢复）；取消 ⇒ 不清库。
 *              ⚠️ 断言不触碰 `syncStatus.pendingCount`（DEF-13 滞后）。
 */

const mocks = vi.hoisted(() => ({
    confirm: vi.fn(),
    countDirty: vi.fn(),
    start: vi.fn(),
    wipeUserData: vi.fn()
}))

vi.mock('nue-ui', () => ({ NueConfirm: mocks.confirm }))

vi.mock('@nao-todo/shared', () => ({ t: (key: string) => key }))

vi.mock('@nao-todo/infrastructure', () => ({
    syncTracker: { countDirty: mocks.countDirty },
    syncService: { start: mocks.start },
    deletionService: { wipeUserData: mocks.wipeUserData }
}))

// 生产侧已改窄子路径导入 ⇒ 同步注册同名深路径 mock（转发到上方 barrel mock，语义不变）
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/sync-tracker',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/sync-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/deletion/deletion-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock('@nao-todo/shared/locales', async () => import('@nao-todo/shared'))

beforeEach(() => {
    vi.clearAllMocks()
    mocks.countDirty.mockResolvedValue(0)
    mocks.start.mockResolvedValue({ ok: true })
    mocks.wipeUserData.mockResolvedValue(undefined)
    mocks.confirm.mockResolvedValue([false])
})

describe('wipeLocalDataOnSignOut - C-54 脏队列护栏 + C-52 清库', () => {
    it('无脏队列 ⇒ 不弹确认，直接清库', async () => {
        await expect(wipeLocalDataOnSignOut('u-1')).resolves.toBe(true)
        expect(mocks.confirm).not.toHaveBeenCalled()
        expect(mocks.wipeUserData).toHaveBeenCalledWith('u-1')
    })

    it('有脏队列 + 用户取消 ⇒ 不清库（绝不静默清）', async () => {
        mocks.countDirty.mockResolvedValue(3)
        mocks.confirm.mockResolvedValueOnce([true])
        await expect(wipeLocalDataOnSignOut('u-1')).resolves.toBe(false)
        expect(mocks.confirm).toHaveBeenCalledTimes(1)
        expect(mocks.wipeUserData).not.toHaveBeenCalled()
    })

    it('有脏队列 + 「先同步」成功清空 ⇒ 单次确认后清库', async () => {
        mocks.countDirty.mockResolvedValueOnce(2).mockResolvedValueOnce(0)
        mocks.confirm.mockResolvedValueOnce([false])
        await expect(wipeLocalDataOnSignOut('u-1')).resolves.toBe(true)
        expect(mocks.confirm).toHaveBeenCalledTimes(1)
        expect(mocks.start).toHaveBeenCalledTimes(1)
        expect(mocks.wipeUserData).toHaveBeenCalledWith('u-1')
    })

    it('「先同步」失败/离线（仍 >0）⇒ 二次确认；取消 ⇒ 不清库', async () => {
        mocks.countDirty.mockResolvedValue(2)
        mocks.start.mockRejectedValue(new Error('offline'))
        mocks.confirm.mockResolvedValueOnce([false]).mockResolvedValueOnce([true])
        await expect(wipeLocalDataOnSignOut('u-1')).resolves.toBe(false)
        expect(mocks.confirm).toHaveBeenCalledTimes(2)
        expect(mocks.wipeUserData).not.toHaveBeenCalled()
    })

    it('二次确认「仍然退出」⇒ 清库（明示不可恢复后用户自决）', async () => {
        mocks.countDirty.mockResolvedValue(2)
        mocks.start.mockResolvedValue({ ok: false })
        mocks.confirm.mockResolvedValueOnce([false]).mockResolvedValueOnce([false])
        await expect(wipeLocalDataOnSignOut('u-1')).resolves.toBe(true)
        expect(mocks.confirm).toHaveBeenCalledTimes(2)
        expect(mocks.wipeUserData).toHaveBeenCalledWith('u-1')
    })

    it('C-55：空 userId ⇒ 不探测、不清库，直接放行', async () => {
        await expect(wipeLocalDataOnSignOut('')).resolves.toBe(true)
        expect(mocks.countDirty).not.toHaveBeenCalled()
        expect(mocks.wipeUserData).not.toHaveBeenCalled()
    })
})