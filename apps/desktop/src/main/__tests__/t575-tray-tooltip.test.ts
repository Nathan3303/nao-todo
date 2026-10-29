import { describe, expect, it, vi } from 'vite-plus/test'
import { UnableToImplementError, loadImpl } from './impl-seam'

/**
 * T575 ② 托盘 tooltip —— 主进程侧（AC7 通道半边 / AC8 降级半边）
 *
 * @description 依据 `T574` arch 评审（`docs/reports/T574-arch-review.md` §二 / §四 / §五.1-2）固化：
 *              - 通道 = `DESKTOP_ONEWAY_CHANNELS.setTrayTooltip`（**独立常量**，⛔ 不并入
 *                `DESKTOP_IPC_CHANNELS`；既有 `ipc.test.ts` 的「4 个 invoke 通道」断言不得改动）；
 *              - 方向 = `ipcMain.on`（**单向**，非 `invoke`）：handler 缺失时 `send` 静默，
 *                正是 AC8 需要的降级形态；
 *              - 载荷 = 单个字符串，**长度 1..64**；非字符串 / 空串 / 超长 ⇒ **回基线 `NaoTodo`**；
 *              - 不受信来源 ⇒ **静默忽略（不抛）**；handler 整体 try/catch；
 *              - 托盘侧 = `TrayHandle.setTooltip(text)`：`unsupported`（`tray === null`）/
 *                `setToolTip` 缺失 / 已销毁（抛错）⇒ 全部 no-op。
 *
 * 期望实现落点：
 *   - `apps/desktop/src/main/ipc.ts`：`DESKTOP_ONEWAY_CHANNELS` + `registerDesktopTrayTooltipHandler`
 *   - `apps/desktop/src/main/tray.ts`：`TrayHandle.setTooltip`（+ 默认 tooltip 基线 `NaoTodo`）
 * @see docs/prds/2026-10-29-pomodoro-notify-title-round.md（§五 页签标题 · §七 AC7 / AC8 · §九 D9）
 * @see docs/reports/T574-arch-review.md（§二 通道规格 · §四 失败降级 · §五 落实清单）
 */

type TrayStatus = 'available' | 'unconfirmed' | 'unsupported'

interface MenuItemLike {
    label: string
    click?: () => void
}

interface TrayLike {
    setToolTip?(toolTip: string): void
    setContextMenu(menu: unknown): void
    destroy(): void
}

interface TrayHandle {
    status: TrayStatus
    tray: TrayLike | null
    setTooltip(text: string): void
    destroy(): void
}

interface TrayModule {
    createTray: (deps: {
        platform: string
        env: Record<string, string | undefined>
        iconPath: string
        actions: { open(): void; quit(): void }
        Tray: new (iconPath: string) => TrayLike
        Menu: { buildFromTemplate(template: readonly MenuItemLike[]): unknown }
        labels?: { open: string; quit: string }
        tooltip?: string
    }) => TrayHandle
}

type IpcListener = (event: { senderFrame?: { url?: string } | null }, ...args: unknown[]) => unknown

interface IpcModule {
    DESKTOP_IPC_CHANNELS: Record<string, string>
    DESKTOP_ONEWAY_CHANNELS: Record<string, string>
    registerDesktopTrayTooltipHandler: (deps: {
        ipcMain: { on(channel: string, listener: IpcListener): void }
        isTrustedUrl(url: string): boolean
        setTrayTooltip(text: string): void
    }) => void
}

const TRAY_MODULE = 'apps/desktop/src/main/tray.ts'
const IPC_MODULE = 'apps/desktop/src/main/ipc.ts'

/** 基线 tooltip（PM 决策 D9/C3：非空串，`setToolTip('')` 会被 Electron 当作移除） */
const BASELINE = 'NaoTodo'
const TRUSTED_URL = 'file:///opt/NaoTodo/renderer/index.html'

/** 取出 handler 注册用的通道名（未注册时给出可读红基线） */
const takeListenerChannel = (on: { mock: { calls: unknown[][] } }): unknown => {
    const call = on.mock.calls[0]
    if (!call)
        throw new Error('[用例] 未注册通道监听器（期望 registerDesktopTrayTooltipHandler 调用 on）')
    return call[0]
}

/** 取出 handler 注册的监听器（未注册时给出可读红基线） */
const takeListener = (on: { mock: { calls: unknown[][] } }): IpcListener => {
    const call = on.mock.calls[0]
    if (!call) {
        throw new Error('[用例] 未注册通道监听器（期望 registerDesktopTrayTooltipHandler 调用 on）')
    }
    return call[1] as IpcListener
}

const loadTray = (ac: string): Promise<TrayModule> =>
    loadImpl<TrayModule>('../tray', TRAY_MODULE, ['createTray'], ac)

const loadIpc = (ac: string): Promise<IpcModule> =>
    loadImpl<IpcModule>(
        '../ipc',
        IPC_MODULE,
        ['DESKTOP_ONEWAY_CHANNELS', 'registerDesktopTrayTooltipHandler'],
        ac
    )

/** 构造托盘 handle（可注入 setToolTip 行为） */
const createHandle = (
    mod: TrayModule,
    options: {
        throwsOnCreate?: boolean
        withoutSetToolTip?: boolean
        setToolTipThrows?: boolean
        tooltip?: string
    } = {}
): { handle: TrayHandle; tooltips: string[] } => {
    const tooltips: string[] = []
    class FakeTray implements TrayLike {
        setToolTip?: (toolTip: string) => void
        constructor() {
            if (options.throwsOnCreate) throw new Error('Tray is not supported on this platform')
            if (!options.withoutSetToolTip) {
                this.setToolTip = (toolTip: string) => {
                    if (options.setToolTipThrows) throw new Error('tray destroyed')
                    tooltips.push(toolTip)
                }
            }
        }
        setContextMenu(): void {}
        destroy(): void {}
    }

    const handle = mod.createTray({
        platform: 'linux',
        env: { XDG_CURRENT_DESKTOP: 'KDE' },
        iconPath: '/tmp/tray.png',
        actions: { open: vi.fn(), quit: vi.fn() },
        Tray: FakeTray as unknown as new (iconPath: string) => TrayLike,
        Menu: { buildFromTemplate: (template: readonly MenuItemLike[]) => template },
        tooltip: options.tooltip
    })
    return { handle, tooltips }
}

/** 断言 `TrayHandle.setTooltip` 已实现（缺实现时给出可读红基线，而不是 TypeError） */
const requireSetTooltip = (handle: TrayHandle): TrayHandle => {
    if (typeof handle.setTooltip !== 'function') {
        throw new UnableToImplementError(
            `[缺实现] ${TRAY_MODULE} 的 TrayHandle 缺少 \`setTooltip(text)\`（AC7）`
        )
    }
    return handle
}

describe('T575 ② AC7/AC8 托盘侧 `setTooltip`', () => {
    it('AC7 托盘可用 ⇒ 写入文案原样（含阶段与剩余时间）', async () => {
        const mod = await loadTray('AC7')
        const { handle, tooltips } = createHandle(mod, { tooltip: BASELINE })
        expect(handle.status).toBe('available')
        requireSetTooltip(handle)

        handle.setTooltip('24:59 · 专注')
        handle.setTooltip('04:30 · 休息')

        expect(tooltips).toEqual(['24:59 · 专注', '04:30 · 休息'])
    })

    it('AC8 status=unsupported（托盘构造失败）⇒ setTooltip 静默 no-op', async () => {
        const mod = await loadTray('AC8')
        const { handle, tooltips } = createHandle(mod, { throwsOnCreate: true })
        expect(handle.status).toBe('unsupported')
        requireSetTooltip(handle)

        expect(() => handle.setTooltip('24:59 · 专注')).not.toThrow()
        expect(tooltips).toHaveLength(0)
    })

    it('AC8 托盘实现无 setToolTip（可选方法缺失）⇒ 静默 no-op', async () => {
        const mod = await loadTray('AC8')
        const { handle, tooltips } = createHandle(mod, { withoutSetToolTip: true })
        requireSetTooltip(handle)

        expect(() => handle.setTooltip('24:59 · 专注')).not.toThrow()
        expect(tooltips).toHaveLength(0)
    })

    it('AC8 setToolTip 抛错（托盘已销毁）⇒ 主进程吞掉，不冒到调用方', async () => {
        const mod = await loadTray('AC8')
        const { handle } = createHandle(mod, { setToolTipThrows: true })
        requireSetTooltip(handle)

        expect(() => handle.setTooltip('24:59 · 专注')).not.toThrow()
    })

    it('D9 基线：未指定 tooltip ⇒ 初始 tooltip 为 `NaoTodo`（非空）', async () => {
        const mod = await loadTray('D9')
        const { handle, tooltips } = createHandle(mod)
        expect(handle.status).toBe('available')
        expect(tooltips[0]).toBe(BASELINE)
    })
})

describe('T575 ② AC7 单向通道常量（R3 守卫：不得并入 invoke 通道集合）', () => {
    it('AC7 `DESKTOP_ONEWAY_CHANNELS.setTrayTooltip = setTrayTooltip` 且独立于 4 个 invoke 通道', async () => {
        const ipc = await loadIpc('AC7')
        expect(ipc.DESKTOP_ONEWAY_CHANNELS.setTrayTooltip).toBe('setTrayTooltip')
        expect(Object.values(ipc.DESKTOP_IPC_CHANNELS)).toHaveLength(4)
        expect(Object.values(ipc.DESKTOP_IPC_CHANNELS)).not.toContain('setTrayTooltip')
    })

    it('AC7 注册用的是单向 `on`（不是 `invoke`/`handle`）', async () => {
        const ipc = await loadIpc('AC7')
        const on = vi.fn()
        const handleReg = vi.fn()
        ipc.registerDesktopTrayTooltipHandler({
            ipcMain: { on, handle: handleReg } as never,
            isTrustedUrl: (url) => url === TRUSTED_URL,
            setTrayTooltip: vi.fn()
        })

        expect(on).toHaveBeenCalledTimes(1)
        expect(takeListenerChannel(on)).toBe('setTrayTooltip')
        expect(handleReg).not.toHaveBeenCalled()
    })
})

describe('T575 ② AC7/AC8 通道 handler（handler → 真实托盘 handle → FakeTray 端到端）', () => {
    /** 注册 handler 并把载荷打到真实托盘上（实现可在 handler 或 tray 侧做基线兜底） */
    const setup = async (ac: string) => {
        const ipc = await loadIpc(ac)
        const tray = await loadTray(ac)
        const { handle, tooltips } = createHandle(tray, { tooltip: BASELINE })
        const on = vi.fn()
        ipc.registerDesktopTrayTooltipHandler({
            ipcMain: { on },
            isTrustedUrl: (url) => url === TRUSTED_URL,
            setTrayTooltip: (text: string) => requireSetTooltip(handle).setTooltip(text)
        })
        return { tooltips, listener: takeListener(on) }
    }

    it('AC7 受信来源 + 合法字符串 ⇒ 写入该文案（单向 send 载荷）', async () => {
        const { tooltips, listener } = await setup('AC7')
        listener({ senderFrame: { url: TRUSTED_URL } }, '24:59 · 专注')
        expect(tooltips[tooltips.length - 1]).toBe('24:59 · 专注')
    })

    it('AC8 不受信来源 ⇒ 静默忽略（不抛、不改 tooltip）', async () => {
        const { tooltips, listener } = await setup('AC8')
        listener({ senderFrame: { url: TRUSTED_URL } }, '24:59 · 专注')
        const before = tooltips.length

        expect(() =>
            listener({ senderFrame: { url: 'https://evil.example' } }, '99:99 · 专注')
        ).not.toThrow()
        expect(tooltips.length).toBe(before)
    })

    it('AC8 来源不可判定（无 senderFrame）⇒ 静默忽略', async () => {
        const { tooltips, listener } = await setup('AC8')
        listener({ senderFrame: { url: TRUSTED_URL } }, '24:59 · 专注')
        const before = tooltips.length

        expect(() => listener({}, '99:99 · 专注')).not.toThrow()
        expect(tooltips.length).toBe(before)
    })

    it('AC8 非字符串载荷 ⇒ 回基线 `NaoTodo`', async () => {
        const { tooltips, listener } = await setup('AC8')
        listener({ senderFrame: { url: TRUSTED_URL } }, '24:59 · 专注')

        listener({ senderFrame: { url: TRUSTED_URL } }, 42 as never)
        expect(tooltips[tooltips.length - 1]).toBe(BASELINE)
    })

    it('AC8 空串载荷 ⇒ 回基线 `NaoTodo`（不得留空 tooltip）', async () => {
        const { tooltips, listener } = await setup('AC8')
        listener({ senderFrame: { url: TRUSTED_URL } }, '24:59 · 专注')

        listener({ senderFrame: { url: TRUSTED_URL } }, '')
        expect(tooltips[tooltips.length - 1]).toBe(BASELINE)
    })

    it('AC8 超长载荷（65 字符 > 64）⇒ 回基线 `NaoTodo`', async () => {
        const { tooltips, listener } = await setup('AC8')
        listener({ senderFrame: { url: TRUSTED_URL } }, '24:59 · 专注')

        listener({ senderFrame: { url: TRUSTED_URL } }, 'a'.repeat(65))
        expect(tooltips[tooltips.length - 1]).toBe(BASELINE)
    })

    it('AC8 托盘写入抛错 ⇒ handler 整体 try/catch，不冒泡', async () => {
        const ipc = await loadIpc('AC8')
        const on = vi.fn()
        ipc.registerDesktopTrayTooltipHandler({
            ipcMain: { on },
            isTrustedUrl: () => true,
            setTrayTooltip: () => {
                throw new Error('tray destroyed')
            }
        })
        const listener = takeListener(on)

        expect(() => listener({ senderFrame: { url: TRUSTED_URL } }, '24:59 · 专注')).not.toThrow()
    })
})