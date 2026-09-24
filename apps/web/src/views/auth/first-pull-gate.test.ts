// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

/**
 * T144 / PS-16 —— web 首拉门
 *
 * **缺口**：web 无 desktop 的 `InitialSyncGate`；业务读路径切本地后「本地空 ⇒ 首屏空」。
 * **验收**：① 本地空且在线 ⇒ 进入等待（`onWait` + 触发首拉）；② 首拉落定 ⇒ 放行；
 * ③ 超时 ⇒ 放行（状态面显示「尚未同步完成」）；④ 有镜像 / 离线 / 未登录 ⇒ 不拦。
 */

const mocks = vi.hoisted(() => ({
    resolveUserIdFromStoredJwt: vi.fn(),
    hasLocalMirror: vi.fn(),
    startWebDataPlane: vi.fn(),
    getFirstPullSettled: vi.fn()
}))

vi.mock('@nao-todo/infrastructure/src/persistence-local/session/local-session', () => ({
    resolveUserIdFromStoredJwt: mocks.resolveUserIdFromStoredJwt
}))
vi.mock('./offline-prerequisites', () => ({ hasLocalMirror: mocks.hasLocalMirror }))
vi.mock('@/data-plane', () => ({
    startWebDataPlane: mocks.startWebDataPlane,
    getFirstPullSettled: mocks.getFirstPullSettled
}))

const { evaluateFirstPullGate, waitForFirstPullGate } = await import('./first-pull-gate')

const setOnline = (online: boolean): void => {
    Object.defineProperty(window.navigator, 'onLine', {
        value: online,
        configurable: true
    })
}

describe('T144 / PS-16 evaluateFirstPullGate（纯判定）', () => {
    it('未登录 ⇒ 放行（认证页不拦）', () => {
        expect(
            evaluateFirstPullGate({
                hasUserId: false,
                hasLocalMirror: false,
                online: true,
                pullSettled: false,
                timedOut: false
            })
        ).toBe('pass')
    })

    it('本地有镜像 ⇒ 立即本地优先放行', () => {
        expect(
            evaluateFirstPullGate({
                hasUserId: true,
                hasLocalMirror: true,
                online: true,
                pullSettled: false,
                timedOut: false
            })
        ).toBe('pass')
    })

    it('本地空 + 离线 ⇒ 放行（既有离线进入引导，不新增拦截）', () => {
        expect(
            evaluateFirstPullGate({
                hasUserId: true,
                hasLocalMirror: false,
                online: false,
                pullSettled: false,
                timedOut: false
            })
        ).toBe('pass')
    })

    it('本地空 + 在线 + 首拉未落定 ⇒ 等待', () => {
        expect(
            evaluateFirstPullGate({
                hasUserId: true,
                hasLocalMirror: false,
                online: true,
                pullSettled: false,
                timedOut: false
            })
        ).toBe('wait')
    })

    it('本地空 + 在线 + 首拉落定 ⇒ 放行', () => {
        expect(
            evaluateFirstPullGate({
                hasUserId: true,
                hasLocalMirror: false,
                online: true,
                pullSettled: true,
                timedOut: false
            })
        ).toBe('pass')
    })

    it('本地空 + 在线 + 超时 ⇒ 超时放行（released）', () => {
        expect(
            evaluateFirstPullGate({
                hasUserId: true,
                hasLocalMirror: false,
                online: true,
                pullSettled: false,
                timedOut: true
            })
        ).toBe('released')
    })
})

describe('T144 / PS-16 waitForFirstPullGate（接线真实依赖）', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setOnline(true)
        mocks.resolveUserIdFromStoredJwt.mockReturnValue('u-1')
        mocks.hasLocalMirror.mockResolvedValue(false)
        mocks.startWebDataPlane.mockReturnValue(undefined)
        mocks.getFirstPullSettled.mockReturnValue(null)
    })

    afterEach(() => {
        setOnline(true)
    })

    it('未登录 ⇒ 放行且不触发首拉', async () => {
        mocks.resolveUserIdFromStoredJwt.mockReturnValue(null)
        const onWait = vi.fn()
        await expect(waitForFirstPullGate({ onWait })).resolves.toBe('pass')
        expect(onWait).not.toHaveBeenCalled()
        expect(mocks.startWebDataPlane).not.toHaveBeenCalled()
    })

    it('本地有镜像 ⇒ 放行且不触发首拉（本地优先）', async () => {
        mocks.hasLocalMirror.mockResolvedValue(true)
        const onWait = vi.fn()
        await expect(waitForFirstPullGate({ onWait })).resolves.toBe('pass')
        expect(onWait).not.toHaveBeenCalled()
        expect(mocks.startWebDataPlane).not.toHaveBeenCalled()
    })

    it('本地空 + 离线 ⇒ 放行（走既有离线进入）', async () => {
        setOnline(false)
        const onWait = vi.fn()
        await expect(waitForFirstPullGate({ onWait })).resolves.toBe('pass')
        expect(onWait).not.toHaveBeenCalled()
        expect(mocks.startWebDataPlane).not.toHaveBeenCalled()
    })

    it('本地空 + 在线 ⇒ 进入等待并触发首拉；首拉落定 ⇒ 放行', async () => {
        mocks.getFirstPullSettled.mockReturnValue(Promise.resolve())
        const onWait = vi.fn()
        await expect(waitForFirstPullGate({ onWait })).resolves.toBe('pass')
        expect(onWait).toHaveBeenCalledTimes(1)
        expect(mocks.startWebDataPlane).toHaveBeenCalledTimes(1)
    })

    it('本地空 + 在线 + 首拉超时 ⇒ 超时放行（released）', async () => {
        mocks.getFirstPullSettled.mockReturnValue(new Promise<void>(() => {}))
        const onWait = vi.fn()
        await expect(waitForFirstPullGate({ onWait, timeoutMs: 5 })).resolves.toBe('released')
        expect(onWait).toHaveBeenCalledTimes(1)
    })

    it('首拉未启动（settled 为 null）⇒ 不永久阻塞，按超时放行', async () => {
        mocks.getFirstPullSettled.mockReturnValue(null)
        await expect(waitForFirstPullGate({ timeoutMs: 5 })).resolves.toBe('released')
    })
})