import { describe, expect, it } from 'vite-plus/test'

/**
 * T544 · 桌面主进程「防回退」守卫（AC12 / R7 / AC1 / AC5 / R14）
 *
 * @description 两类守卫，都是**实现落地后会静默失效**的关键点，必须在测试里钉死：
 *              ① `webPreferences.backgroundThrottling: false` —— 缺了不会报错，只会让窗口隐藏后
 *                 `document.visibilityState` 变 `hidden` ⇒ 提醒引擎停轮询 ⇒ 提醒静默变慢（R7）；
 *              ② 状态机**接线**——`close` / `second-instance` / `window-all-closed` /
 *                 退出信号必须真的接到主进程事件上，否则「状态机写好了但没接」也会全绿。
 *
 * 口径说明：①② 都是「源码文本级」守卫（读主进程全部源文件），能防回退但不验证运行时行为；
 * 运行时行为由 `lifecycle.test.ts`（注入式状态机）+ 真机验收覆盖。
 * @see docs/reports/T543-arch-review.md（§五 5.2 防回退守卫 / §五 5.1 状态机）
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC12 / R7）
 */

const SOURCES = import.meta.glob('/apps/desktop/src/main/**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>

/** 主进程源码（排除测试自身，`__tests__/` 里的字符串不该算作实现） */
const MAIN_SOURCES = Object.entries(SOURCES).filter(([path]) => !path.includes('__tests__'))

const findFiles = (pattern: RegExp): string[] =>
    MAIN_SOURCES.filter(([, source]) => pattern.test(source)).map(([path]) => path)

const describeSources = (): string =>
    `已扫描 ${MAIN_SOURCES.length} 个主进程源文件：${MAIN_SOURCES.map(([p]) => p).join('、')}`

describe('防回退 · backgroundThrottling（AC12 / R7）', () => {
    it('主进程必须设 backgroundThrottling: false（否则隐藏后提醒静默变慢且无报错）', () => {
        const files = findFiles(/backgroundThrottling\s*:\s*false/)

        expect(
            files,
            `[R7 防回退] 未找到 backgroundThrottling: false —— 窗口隐藏后 visibilityState 会变 hidden，` +
                `提醒引擎将停止 10s 轮询（提醒变慢且无任何报错）。${describeSources()}`
        ).toHaveLength(1)
    })

    it('backgroundThrottling 设在创建 BrowserWindow 的文件里（不是写在注释/死代码里）', () => {
        const files = findFiles(/backgroundThrottling\s*:\s*false/)
        const offenders = files.filter((path) => !/new BrowserWindow\(/.test(SOURCES[path] ?? ''))

        expect(
            offenders,
            `[R7 防回退] backgroundThrottling: false 出现在不创建 BrowserWindow 的文件：${offenders.join('、')}`
        ).toEqual([])
    })

    it('不得出现 backgroundThrottling: true（防被「优化」成默认值）', () => {
        expect(findFiles(/backgroundThrottling\s*:\s*true/)).toEqual([])
    })
})

describe('防回退 · 主进程事件接线（AC1 / AC5 / R14）', () => {
    it('close 接到状态机（关窗隐藏，AC1）', () => {
        expect(findFiles(/on\(\s*['"]close['"]/).length, '主进程未注册 close 事件').toBeGreaterThan(
            0
        )
        expect(
            findFiles(/handleWindowClose/).length,
            'close 未接到 handleWindowClose'
        ).toBeGreaterThan(0)
    })

    it('second-instance 接到状态机（含 --autostart 静默，AC5）', () => {
        expect(
            findFiles(/on\(\s*['"]second-instance['"]/).length,
            '主进程未注册 second-instance 事件'
        ).toBeGreaterThan(0)
        expect(
            findFiles(/handleSecondInstance/).length,
            'second-instance 未接到 handleSecondInstance'
        ).toBeGreaterThan(0)
    })

    it('window-all-closed 接到状态机（常驻态不退出，AC1 / AC9①）', () => {
        expect(
            findFiles(/on\(\s*['"]window-all-closed['"]/).length,
            '主进程未注册 window-all-closed 事件'
        ).toBeGreaterThan(0)
        expect(
            findFiles(/handleWindowAllClosed/).length,
            'window-all-closed 未接到 handleWindowAllClosed'
        ).toBeGreaterThan(0)
    })

    it('退出信号齐备：before-quit / query-session-end / session-end（R14 不拦系统关机）', () => {
        expect(findFiles(/before-quit/).length, '缺少 before-quit').toBeGreaterThan(0)
        expect(
            findFiles(/query-session-end/).length,
            '缺少 Windows query-session-end'
        ).toBeGreaterThan(0)
        expect(findFiles(/['"]session-end['"]/).length, '缺少 Windows session-end').toBeGreaterThan(
            0
        )
    })
})