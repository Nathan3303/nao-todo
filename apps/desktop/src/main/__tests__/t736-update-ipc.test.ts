import { describe, expect, it, vi } from 'vite-plus/test'
import type { DesktopUpdateStatus } from '@nao-todo/shared'
import {
    DESKTOP_IPC_CHANNELS,
    DESKTOP_UPDATE_CHANNELS,
    DESKTOP_UPDATE_STATUS_CHANNEL,
    bindUpdateStatusWindow,
    publishUpdateStatus,
    registerDesktopUpdateHandlers
} from '../ipc'

/**
 * T736 · 更新 IPC 面（AC1–AC11 的渲染层入口）
 *
 * @description 三条约定：① 通道**独立**（`DESKTOP_IPC_CHANNELS` 的「4 个窄通道」契约不变）；
 *              ② 每个 handler 先校验发送方来源（不受信 ⇒ 拒绝且不执行动作）；
 *              ③ 「安装并重启」只接受 `{ force?: boolean }`（AC9 二次确认的唯一载荷面）。
 */

const TRUSTED = 'file:///opt/nao-todo/out/renderer/index.html'

interface IpcEventLike {
    senderFrame?: { url?: string } | null
}

type IpcListener = (event: IpcEventLike, ...args: unknown[]) => unknown

const status: DesktopUpdateStatus = {
    state: 'available',
    currentVersion: '1.20.3',
    latestVersion: '1.21.0',
    sizeBytes: 113_246_208,
    installMode: 'in-place',
    updateAvailable: true
}

const createHarness = () => {
    const listeners = new Map<string, IpcListener>()
    const updater = {
        getStatus: vi.fn(() => status),
        check: vi.fn(async () => ({ ...status, state: 'available' as const })),
        download: vi.fn(async () => ({ ...status, state: 'ready' as const })),
        install: vi.fn(async () => ({ installed: true })),
        openDownloadPage: vi.fn(async () => undefined)
    }
    registerDesktopUpdateHandlers({
        ipcMain: {
            handle: (channel, listener) => {
                listeners.set(channel, listener)
            }
        },
        isTrustedUrl: (url) => url.startsWith('file://'),
        updater
    })
    const invoke = async (channel: string, event: IpcEventLike, ...args: unknown[]) =>
        await (listeners.get(channel) as IpcListener)(event, ...args)
    return { listeners, updater, invoke }
}

describe('更新通道面（安全语义）', () => {
    it('注册 5 个更新通道，且与既有 4 个窄通道不重名（原契约不变）', () => {
        const { listeners } = createHarness()
        expect([...listeners.keys()].sort()).toEqual(Object.values(DESKTOP_UPDATE_CHANNELS).sort())
        expect(listeners.size).toBe(5)
        const existing = new Set<string>(Object.values(DESKTOP_IPC_CHANNELS))
        for (const channel of Object.values(DESKTOP_UPDATE_CHANNELS)) {
            expect(existing.has(channel)).toBe(false)
        }
    })

    it('受信来源 ⇒ getStatus 返回主进程状态（设置页数据源）', async () => {
        const { invoke, updater } = createHarness()
        const result = await invoke(DESKTOP_UPDATE_CHANNELS.getStatus, {
            senderFrame: { url: TRUSTED }
        })
        expect(result).toEqual(status)
        expect(updater.getStatus).toHaveBeenCalledTimes(1)
    })

    it('不受信来源 / 来源不可判定 ⇒ 拒绝且不执行任何动作', async () => {
        const { invoke, updater } = createHarness()
        for (const channel of Object.values(DESKTOP_UPDATE_CHANNELS)) {
            await expect(
                invoke(channel, { senderFrame: { url: 'https://evil.example.com/' } })
            ).rejects.toThrow()
            await expect(invoke(channel, {})).rejects.toThrow()
        }
        expect(updater.getStatus).not.toHaveBeenCalled()
        expect(updater.check).not.toHaveBeenCalled()
        expect(updater.download).not.toHaveBeenCalled()
        expect(updater.install).not.toHaveBeenCalled()
        expect(updater.openDownloadPage).not.toHaveBeenCalled()
    })

    it('check / download / openDownloadPage 各透传一次（零重复业务逻辑）', async () => {
        const { invoke, updater } = createHarness()
        const event = { senderFrame: { url: TRUSTED } }
        await invoke(DESKTOP_UPDATE_CHANNELS.check, event)
        await invoke(DESKTOP_UPDATE_CHANNELS.download, event)
        await invoke(DESKTOP_UPDATE_CHANNELS.openDownloadPage, event)
        expect(updater.check).toHaveBeenCalledTimes(1)
        expect(updater.download).toHaveBeenCalledTimes(1)
        expect(updater.openDownloadPage).toHaveBeenCalledTimes(1)
    })

    it('安装只接受 { force?: boolean }（AC9 二次确认面）', async () => {
        const { invoke, updater } = createHarness()
        const event = { senderFrame: { url: TRUSTED } }

        await invoke(DESKTOP_UPDATE_CHANNELS.install, event, { force: true })
        expect(updater.install).toHaveBeenLastCalledWith({ force: true })

        // 无载荷 / 非对象 / force 非布尔 ⇒ 视为未确认（安全侧默认）
        await invoke(DESKTOP_UPDATE_CHANNELS.install, event)
        expect(updater.install).toHaveBeenLastCalledWith({})
        await invoke(DESKTOP_UPDATE_CHANNELS.install, event, { force: 'yes' })
        expect(updater.install).toHaveBeenLastCalledWith({})
        await invoke(DESKTOP_UPDATE_CHANNELS.install, event, 'force')
        expect(updater.install).toHaveBeenLastCalledWith({})
        expect(updater.install).toHaveBeenCalledTimes(4)
    })
})

describe('状态推播（单向）', () => {
    const createWindow = (destroyed = false) => {
        const sent: Array<{ channel: string; payload: unknown }> = []
        const loaded: Array<() => void> = []
        const window = {
            isDestroyed: () => destroyed,
            webContents: {
                send: (channel: string, ...args: unknown[]) => {
                    sent.push({ channel, payload: args[0] })
                },
                on: (_event: 'did-finish-load', listener: () => void) => {
                    loaded.push(listener)
                    return window.webContents
                }
            }
        }
        return { window, sent, loaded }
    }

    it('推到固定通道（含下载进度同一条载荷）', () => {
        const { window, sent } = createWindow()
        const downloading: DesktopUpdateStatus = {
            ...status,
            state: 'downloading',
            downloadedBytes: 56_623_104,
            totalBytes: 113_246_208,
            percent: 50
        }
        publishUpdateStatus(window, downloading)
        expect(sent).toEqual([{ channel: DESKTOP_UPDATE_STATUS_CHANNEL, payload: downloading }])
    })

    it('窗口已销毁 ⇒ 静默降级（不抛、不发）', () => {
        const { window, sent } = createWindow(true)
        expect(() => publishUpdateStatus(window, status)).not.toThrow()
        expect(sent).toHaveLength(0)
    })

    it('页面加载完成 ⇒ 补推当前真值（首帧不空洞）', () => {
        const { window, sent, loaded } = createWindow()
        bindUpdateStatusWindow(window, () => status)
        expect(loaded).toHaveLength(1)
        expect(sent).toHaveLength(0)
        loaded[0]?.()
        expect(sent).toEqual([{ channel: DESKTOP_UPDATE_STATUS_CHANNEL, payload: status }])
    })

    it('拿不到状态（更新器未装配）⇒ 不推播', () => {
        const { window, sent, loaded } = createWindow()
        bindUpdateStatusWindow(window, () => null)
        loaded[0]?.()
        expect(sent).toHaveLength(0)
    })
})