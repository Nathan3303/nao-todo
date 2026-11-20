import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createUpdateStore } from '../store'
import { UPDATE_STARTUP_CHECK_DELAY_MS, createDesktopUpdater } from '../wiring'

/**
 * T736 · 启动期接线（ADR「启动不阻断」· PRD §六 性能）
 *
 * @description 断言三件事：① 静默检查延后 ≥10s（不阻塞首屏）；② `start()` 幂等；
 *              ③ 定时器/检查/回调任何异常都**不出本模块**（窗口创建优先级更高）。
 */

const dirs: string[] = []

afterEach(() => {
    while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true })
})

const createHarness = (startupCheckDelayMs?: number) => {
    const dir = mkdtempSync(join(tmpdir(), 'nao-update-wiring-'))
    dirs.push(dir)
    const timers: Array<{ callback: () => void; delayMs: number }> = []
    const checker = { check: vi.fn(async () => ({ version: '1.21.0' })) }
    const onError = vi.fn()
    const updater = createDesktopUpdater({
        env: {
            currentVersion: () => '1.20.3',
            platform: 'linux',
            appimage: '/tmp/nao-todo.AppImage',
            isPackaged: true,
            openDownloadPage: vi.fn()
        },
        checker,
        downloader: { download: vi.fn(async () => ({ ok: true })) },
        installer: { install: vi.fn() },
        syncGuard: { hasPendingChanges: () => false },
        store: createUpdateStore(dir),
        startupCheckDelayMs,
        timer: {
            setTimeout: (callback, delayMs) => {
                timers.push({ callback, delayMs })
                return timers.length
            }
        },
        onError
    })
    return { updater, timers, checker, onError }
}

describe('启动静默检查（延迟与幂等）', () => {
    it('构造后不排定时器（零网络、零延迟副作用）', () => {
        const harness = createHarness()
        expect(harness.timers).toHaveLength(0)
        expect(harness.updater.core.getStatus().state).toBe('idle')
    })

    it('start() 排一次静默检查，延后 ≥10s（传更小值会被抬到 10s）', () => {
        const harness = createHarness(0)
        harness.updater.start()
        expect(harness.timers).toHaveLength(1)
        expect(harness.timers[0]?.delayMs).toBe(UPDATE_STARTUP_CHECK_DELAY_MS)
        expect(harness.timers[0]?.delayMs).toBeGreaterThanOrEqual(10_000)
    })

    it('start() 幂等：重复调用只排一次（多入口/重载不叠加请求）', () => {
        const harness = createHarness()
        harness.updater.start()
        harness.updater.start()
        harness.updater.start()
        expect(harness.timers).toHaveLength(1)
    })

    it('到点执行静默检查（manual=false ⇒ 走缓存判定）', async () => {
        const harness = createHarness()
        harness.updater.start()
        harness.timers[0]?.callback()
        await vi.waitFor(() => expect(harness.checker.check).toHaveBeenCalledTimes(1))
        expect(harness.updater.core.getStatus().state).toBe('available')
    })
})

describe('异常不外抛（ADR「启动不阻断」）', () => {
    it('检查失败只落状态 + onError，不抛到调用点', async () => {
        const harness = createHarness()
        harness.checker.check.mockRejectedValueOnce(new Error('网络炸了'))
        harness.updater.start()
        expect(() => harness.timers[0]?.callback()).not.toThrow()
        await vi.waitFor(() => expect(harness.onError).toHaveBeenCalled())
        expect(harness.updater.core.getStatus().state).toBe('failed')
    })

    it('定时器本身抛错 ⇒ start() 不抛，只报 onError', () => {
        const dir = mkdtempSync(join(tmpdir(), 'nao-update-wiring-'))
        dirs.push(dir)
        const onError = vi.fn()
        const updater = createDesktopUpdater({
            env: {
                currentVersion: () => '1.20.3',
                platform: 'linux',
                appimage: '/tmp/nao-todo.AppImage',
                isPackaged: true,
                openDownloadPage: vi.fn()
            },
            checker: { check: vi.fn(async () => ({ version: '1.21.0' })) },
            downloader: { download: vi.fn(async () => ({ ok: true })) },
            installer: { install: vi.fn() },
            syncGuard: { hasPendingChanges: () => false },
            store: createUpdateStore(dir),
            timer: {
                setTimeout: () => {
                    throw new Error('没有定时器')
                }
            },
            onError
        })

        expect(() => updater.start()).not.toThrow()
        expect(onError).toHaveBeenCalledTimes(1)
        expect(updater.core.getStatus().state).toBe('idle')
    })
})