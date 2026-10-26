import { describe, expect, it, vi } from 'vite-plus/test'
import { loadImpl } from './impl-seam'

/**
 * T544 · 主进程 IPC 面（AC2 / AC13 / 安全语义）
 *
 * @description 渲染层只能通过 4 个窄通道与主进程交互（`getShellStatus` / `setAutostart` /
 *              `showMainWindow` / `quit`），**不接受任意路径/任意命令**；每个 handler 必须先校验
 *              发送方来源（`senderFrame.url` 受信），不受信 ⇒ 拒绝且不执行动作。
 *              不传 token、不传文件路径（安全语义见评审 §六）。
 *
 * 期望实现落点：`apps/desktop/src/main/ipc.ts`
 * 契约：`DESKTOP_IPC_CHANNELS` / `registerDesktopIpcHandlers({ ipcMain, isTrustedUrl, actions })`
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC2 / AC13）
 * @see docs/reports/T543-arch-review.md（§二 2.1 ipc.ts / §六 凭据暴露面不变）
 */

interface IpcEventLike {
    senderFrame?: { url?: string } | null
}

type IpcListener = (event: IpcEventLike, ...args: unknown[]) => unknown

interface IpcModule {
    DESKTOP_IPC_CHANNELS: {
        getShellStatus: string
        setAutostart: string
        showMainWindow: string
        quit: string
    }
    registerDesktopIpcHandlers(deps: {
        ipcMain: { handle(channel: string, listener: IpcListener): void }
        isTrustedUrl(url: string): boolean
        actions: {
            getShellStatus(): unknown
            setAutostart(enabled: boolean): unknown
            showMainWindow(): void
            quit(): void
        }
    }): void
}

const MODULE = 'apps/desktop/src/main/ipc.ts'
const load = (ac: string): Promise<IpcModule> =>
    loadImpl<IpcModule>(
        '../ipc',
        MODULE,
        ['DESKTOP_IPC_CHANNELS', 'registerDesktopIpcHandlers'],
        ac
    )

const TRUSTED = 'file:///opt/nao-todo/out/renderer/index.html'

const createHarness = async (ac: string) => {
    const mod = await load(ac)
    const listeners = new Map<string, IpcListener>()
    const actions = {
        getShellStatus: vi.fn(() => ({ tray: 'available', autostart: 'enabled' })),
        setAutostart: vi.fn(() => ({ autostart: 'enabled' })),
        showMainWindow: vi.fn(),
        quit: vi.fn()
    }
    mod.registerDesktopIpcHandlers({
        ipcMain: {
            handle: (channel, listener) => {
                listeners.set(channel, listener)
            }
        },
        isTrustedUrl: (url) => url.startsWith('file://') || url.startsWith('http://localhost:5173'),
        actions
    })

    const invoke = async (channel: string, event: IpcEventLike, ...args: unknown[]) => {
        const listener = listeners.get(channel)
        if (!listener) throw new Error(`未注册通道：${channel}`)
        return await listener(event, ...args)
    }

    return { mod, listeners, actions, invoke }
}

describe('IPC 通道面（AC13 / 安全）', () => {
    it('只注册 4 个通道（不开放任意命令/路径）', async () => {
        const { listeners } = await createHarness('AC13')

        expect([...listeners.keys()].sort()).toEqual(
            ['getShellStatus', 'setAutostart', 'showMainWindow', 'quit'].sort()
        )
    })

    it('getShellStatus ⇒ 返回主进程状态（设置页数据源，AC13）', async () => {
        const { mod, invoke } = await createHarness('AC13')

        const status = await invoke(mod.DESKTOP_IPC_CHANNELS.getShellStatus, {
            senderFrame: { url: TRUSTED }
        })

        expect(status).toEqual({ tray: 'available', autostart: 'enabled' })
    })

    it('setAutostart(true) ⇒ 透传布尔值（不接受任意对象，AC10）', async () => {
        const { mod, invoke, actions } = await createHarness('AC10')

        await invoke(mod.DESKTOP_IPC_CHANNELS.setAutostart, { senderFrame: { url: TRUSTED } }, true)

        expect(actions.setAutostart).toHaveBeenCalledWith(true)
    })

    it('showMainWindow / quit ⇒ 触发对应动作（托盘不可见时的退出路径，AC9② / AC2）', async () => {
        const { mod, invoke, actions } = await createHarness('AC2')

        await invoke(mod.DESKTOP_IPC_CHANNELS.showMainWindow, { senderFrame: { url: TRUSTED } })
        await invoke(mod.DESKTOP_IPC_CHANNELS.quit, { senderFrame: { url: TRUSTED } })

        expect(actions.showMainWindow).toHaveBeenCalledTimes(1)
        expect(actions.quit).toHaveBeenCalledTimes(1)
    })

    it('不受信来源（外部 URL）⇒ 拒绝且不执行动作（安全语义）', async () => {
        const { mod, invoke, actions } = await createHarness('AC13')

        await expect(
            invoke(mod.DESKTOP_IPC_CHANNELS.quit, {
                senderFrame: { url: 'https://evil.example/x' }
            })
        ).rejects.toThrow()
        expect(actions.quit).not.toHaveBeenCalled()
    })

    it('无 senderFrame（来源不可判定）⇒ 拒绝且不执行动作（默认拒绝）', async () => {
        const { mod, invoke, actions } = await createHarness('AC13')

        await expect(
            invoke(mod.DESKTOP_IPC_CHANNELS.getShellStatus, { senderFrame: null })
        ).rejects.toThrow()
        expect(actions.getShellStatus).not.toHaveBeenCalled()
    })
})