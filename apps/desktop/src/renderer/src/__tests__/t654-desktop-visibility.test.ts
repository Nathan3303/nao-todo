import { describe, expect, it, vi } from 'vite-plus/test'
import {
    bindDesktopWindowVisibility,
    hasWindowVisibilityBridge,
    type WindowVisibilitySubscribe
} from '../window-visibility'

/**
 * T654 · AC5（桌面分支）/ R-10 —— 渲染层可见性来源必须是主进程 IPC
 *
 * @description `backgroundThrottling:false` 下 `document.visibilityState` 恒为 `visible`
 *              ⇒ 桌面若用它当门控，窗口在托盘里也会照拉（且**无任何报错**）。
 *              本文件锁三条：① IPC 信号真的接到门控；② 旧 preload 缺方法 ⇒ 安全降级；
 *              ③ 源码守卫：桌面可见性适配层**不得**读 `visibilityState`。
 * @see docs/prds/2026-11-05-sync-perception-polling.md（R-10 / AC5）
 */

const createTarget = () => {
    const setVisible = vi.fn<(visible: boolean) => void>()
    return { setVisible }
}

const createBridge = (): {
    bridge: { onWindowVisibility: WindowVisibilitySubscribe }
    emit: (visible: boolean) => void
    unsubscribe: ReturnType<typeof vi.fn>
} => {
    let listener: ((visible: boolean) => void) | null = null
    const unsubscribe = vi.fn(() => {
        listener = null
    })
    return {
        bridge: {
            onWindowVisibility: (callback) => {
                listener = callback
                return unsubscribe
            }
        },
        emit: (visible) => listener?.(visible),
        unsubscribe
    }
}

describe('T654 · AC5 桌面渲染层可见性接线', () => {
    it('主进程 `hide` ⇒ setVisible(false)；`show` ⇒ setVisible(true)', () => {
        const target = createTarget()
        const { bridge, emit } = createBridge()
        bindDesktopWindowVisibility(target, bridge)

        emit(false)
        emit(true)

        expect(target.setVisible.mock.calls).toEqual([[false], [true]])
    })

    it('取消订阅后被释放（卸载 / 登出，AC10）', () => {
        const target = createTarget()
        const { bridge, emit, unsubscribe } = createBridge()
        const off = bindDesktopWindowVisibility(target, bridge)

        off()
        expect(unsubscribe).toHaveBeenCalledTimes(1)
        emit(false)
        expect(target.setVisible).not.toHaveBeenCalled()
    })

    it('无桥（Web / 测试）⇒ 安全 no-op，不抛错', () => {
        const target = createTarget()
        const off = bindDesktopWindowVisibility(target, null)
        expect(() => off()).not.toThrow()
        expect(target.setVisible).not.toHaveBeenCalled()
        expect(hasWindowVisibilityBridge(null)).toBe(false)
    })

    it('旧 preload（无 onWindowVisibility）⇒ 安全 no-op，不抛错', () => {
        const target = createTarget()
        const off = bindDesktopWindowVisibility(target, {} as never)
        expect(() => off()).not.toThrow()
        expect(target.setVisible).not.toHaveBeenCalled()
        expect(hasWindowVisibilityBridge({} as never)).toBe(false)
    })

    it('桥可用时 hasWindowVisibilityBridge = true（装配层据此不退回 document）', () => {
        const { bridge } = createBridge()
        expect(hasWindowVisibilityBridge(bridge)).toBe(true)
    })
})

const SOURCES = import.meta.glob('/apps/desktop/src/renderer/src/**/*.{ts,vue}', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>

const RENDERER_SOURCES = Object.entries(SOURCES).filter(([path]) => !path.includes('__tests__'))

describe('T654 · R-10 源码守卫（桌面不得用 visibilityState 冒充窗口可见性）', () => {
    it('可见性适配层不读 `visibilityState`、不注册 `visibilitychange`', () => {
        const adapter = SOURCES['/apps/desktop/src/renderer/src/window-visibility.ts'] ?? ''
        expect(adapter).not.toBe('')
        // 守卫「真实读取 / 监听」，注释里出现该词是允许的（文档需要点名它）
        expect(adapter).not.toMatch(/visibilitychange/)
        expect(adapter).not.toMatch(/\.visibilityState\s*(===|!==|=)/)
    })

    it('AppRoot 走 IPC 适配层，且显式关闭 document 可见性托管', () => {
        const appRoot = SOURCES['/apps/desktop/src/renderer/src/AppRoot.vue'] ?? ''
        expect(appRoot).not.toBe('')
        expect(appRoot).toContain('bindDesktopWindowVisibility(')
        expect(appRoot).toContain('manageDocumentVisibility')
    })

    it('AppRoot 不自己注册 document 可见性监听（唯一来源 = IPC）', () => {
        const appRoot = SOURCES['/apps/desktop/src/renderer/src/AppRoot.vue'] ?? ''
        expect(appRoot).not.toMatch(/addEventListener\(\s*'visibilitychange'/)
        // 其余渲染层文件允许用 visibilityState 做别的事（如会话续期），此处只锁「轮询门控」的接线点
        expect(RENDERER_SOURCES.length).toBeGreaterThan(0)
    })
})