import { describe, expect, it } from 'vite-plus/test'
import {
    DESKTOP_WINDOW_VISIBILITY_CHANNEL,
    bindWindowVisibility,
    type WindowVisibilityLike
} from '../ipc'

/**
 * T654 · AC5（**桌面分支**）/ R-10 —— 托盘隐藏 = 停轮询，唯一信号是主进程 IPC
 *
 * @description 断言主进程把 `show` / `hide` / 首帧（`did-finish-load`）翻译成渲染层可见性消息；
 *              并保留「防回退」源码守卫：`backgroundThrottling` 必须是 `false` —— 一旦被改回 `true`，
 *              窗口隐藏后 `document.visibilityState` 会变 `hidden`（提醒引擎静默变慢），
 *              而桌面轮询门控**本就不该**依赖它（R-10），两条守卫同时变红。
 * @see docs/prds/2026-11-05-sync-perception-polling.md（R-10 / AC5）
 */

interface SentMessage {
    channel: string
    args: unknown[]
}

const createWindow = (
    visible: boolean,
    options: { destroyed?: boolean } = {}
): {
    win: WindowVisibilityLike
    sent: SentMessage[]
    emitShow: () => void
    emitHide: () => void
    emitLoaded: () => void
    setVisible: (next: boolean) => void
} => {
    let currentVisible = visible
    const sent: SentMessage[] = []
    const windowHandlers = new Map<string, () => void>()
    const webHandlers = new Map<string, () => void>()
    const win: WindowVisibilityLike = {
        isVisible: () => currentVisible,
        isDestroyed: () => options.destroyed === true,
        on: (event, listener) => {
            windowHandlers.set(event, listener)
        },
        webContents: {
            send: (channel, ...args) => {
                sent.push({ channel, args })
            },
            on: (event, listener) => {
                webHandlers.set(event, listener)
            }
        }
    }
    return {
        win,
        sent,
        emitShow: () => windowHandlers.get('show')?.(),
        emitHide: () => windowHandlers.get('hide')?.(),
        emitLoaded: () => webHandlers.get('did-finish-load')?.(),
        setVisible: (next) => {
            currentVisible = next
        }
    }
}

describe('T654 · AC5 桌面窗口可见性 IPC', () => {
    it('从托盘唤回（show）⇒ 推 `true`；隐藏到托盘（hide）⇒ 推 `false`', () => {
        const h = createWindow(true)
        bindWindowVisibility(h.win)

        h.setVisible(false)
        h.emitHide()
        h.setVisible(true)
        h.emitShow()

        expect(h.sent).toEqual([
            { channel: DESKTOP_WINDOW_VISIBILITY_CHANNEL, args: [false] },
            { channel: DESKTOP_WINDOW_VISIBILITY_CHANNEL, args: [true] }
        ])
    })

    it('首帧加载完成即推当前可见性（自启静默到托盘 ⇒ 初值必须是 `false`）', () => {
        const h = createWindow(false)
        bindWindowVisibility(h.win)

        h.emitLoaded()

        expect(h.sent).toEqual([{ channel: DESKTOP_WINDOW_VISIBILITY_CHANNEL, args: [false] }])
    })

    it('窗口已销毁 ⇒ 不发送（不抛错）', () => {
        const h = createWindow(true, { destroyed: true })
        bindWindowVisibility(h.win)

        h.emitShow()
        h.emitHide()
        h.emitLoaded()

        expect(h.sent).toEqual([])
    })

    it('渲染层 send 抛错 ⇒ 主进程不崩（生命周期间接影响）', () => {
        const h = createWindow(true)
        const win: WindowVisibilityLike = {
            isVisible: () => h.win.isVisible(),
            isDestroyed: () => h.win.isDestroyed(),
            on: (event, listener) => h.win.on(event, listener),
            webContents: {
                send: () => {
                    throw new Error('webContents destroyed')
                },
                on: (event, listener) => h.win.webContents.on(event, listener)
            }
        }
        bindWindowVisibility(win)
        expect(() => h.emitShow()).not.toThrow()
    })
})

const SOURCES = import.meta.glob('/apps/desktop/src/main/**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>

const MAIN_SOURCES = Object.entries(SOURCES).filter(([path]) => !path.includes('__tests__'))

const findFiles = (pattern: RegExp): string[] =>
    MAIN_SOURCES.filter(([, source]) => pattern.test(source)).map(([path]) => path)

describe('T654 · 防回退守卫（R-10 / AC5）', () => {
    it('`backgroundThrottling` 必须为 `false`（改回 `true` ⇒ 隐藏后 visibilityState 变 hidden，提醒静默变慢）', () => {
        expect(findFiles(/backgroundThrottling\s*:\s*false/)).toHaveLength(1)
        expect(findFiles(/backgroundThrottling\s*:\s*true/)).toEqual([])
    })

    it('主进程真的接上了可见性推播（写好了但没接线会静默失效）', () => {
        expect(findFiles(/bindWindowVisibility\(/).length).toBeGreaterThan(0)
    })

    it('可见性通道名唯一真源在 `ipc.ts`（不在多处硬编码字符串）', () => {
        const offenders = MAIN_SOURCES.filter(
            ([path, source]) =>
                !path.endsWith('/ipc.ts') && source.includes("'nao:window-visibility'")
        ).map(([path]) => path)
        expect(offenders).toEqual([])
    })
})