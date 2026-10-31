// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPinia, setActivePinia } from 'pinia'
import { useThemeStore } from '../theme-store'

/**
 * T589 红基线 —— AC9 `matchMedia` 守卫（`DEF-96`，ADR D7）
 *
 * 缺陷现场：`initSystemListener()` 直接 `window.matchMedia(...).matches` 并 `addEventListener`，
 * 环境无 `matchMedia`（受限 WebView / 测试壳 / 老环境）⇒ 启动即抛错（`app.ts` 初始化链路中断）。
 *
 * 判据（PM 裁定 ④：可见口径 = 结构化日志 + 主题回退，**不弹 UI**）：
 * - `matchMedia` 缺失 ⇒ 初始化不抛错，主题回退默认（`system` → `light`，根变量 `--nue-dark-switch=0`）；
 * - 正常 `matchMedia`（dark 偏好）⇒ 仍解析为 dark（回归护栏）；
 * - 降级留结构化日志痕迹。
 *
 * 状态：**红**（无守卫）。
 * 变异易感：去掉守卫 ⇒ 抛错 ⇒ 红。
 */

const spyConsole = (): string[] => {
    const lines: string[] = []
    const record = (...args: unknown[]) => {
        lines.push(args.map((arg) => String(arg)).join(' '))
    }
    vi.spyOn(console, 'warn').mockImplementation(record)
    vi.spyOn(console, 'log').mockImplementation(record)
    vi.spyOn(console, 'error').mockImplementation(record)
    return lines
}

beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.documentElement.style.removeProperty('--nue-dark-switch')
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
})

describe('AC9：matchMedia 缺失 ⇒ 主题初始化降级', () => {
    it('不抛错，回退默认浅色（根变量 = 0）', () => {
        spyConsole()
        vi.stubGlobal('matchMedia', undefined)
        const store = useThemeStore()

        expect(() => store.initSystemListener()).not.toThrow()
        expect(store.actualTheme).toBe('light')
        expect(document.documentElement.style.getPropertyValue('--nue-dark-switch')).toBe('0')
    })

    it('降级留结构化日志痕迹', () => {
        const lines = spyConsole()
        vi.stubGlobal('matchMedia', undefined)
        const store = useThemeStore()

        store.initSystemListener()

        const visible = lines.some((line) => /theme|matchmedia|media/i.test(line))
        expect(visible, `实际日志：${lines.join(' | ') || '（无输出）'}`).toBe(true)
    })
})

describe('AC9 回归护栏：matchMedia 正常时行为不变', () => {
    it('系统深色偏好 ⇒ actualTheme = dark', () => {
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => ({
                matches: true,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn()
            }))
        )
        const store = useThemeStore()

        store.initSystemListener()

        expect(store.actualTheme).toBe('dark')
    })
})