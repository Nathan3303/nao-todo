// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { setLocale } from '@nao-todo/shared/locales'
import CalendarViewSwitch from '../view-switch.vue'

/**
 * T445 ① 子视图切换器组件级契约（纯展示件：当前态 + onSwitch 注入）
 * @description 两态复用同一组件：
 *  - `segmented`：侧边栏顶部（三格分段，当前态高亮，点击上抛子路由名）；
 *  - `compact`：内容区头部（侧栏隐藏兜底），触发器=当前视图名，下拉三项 data-executeid=子路由名。
 *  本组件不读路由；路由切换语义由调用方（侧边栏 = router.replace；头部 = 视图上下文 onGo*）承担。
 */

// 模拟 NueDropdown 的 execute 委托（点 `[data-executeid]` 上抛）
const DropdownStub = defineComponent({
    name: 'NueDropdown',
    emits: ['execute'],
    setup(_, { slots, emit }) {
        const onClick = (event: MouseEvent): void => {
            const el = (event.target as Element | null)?.closest('[data-executeid]')
            if (el) emit('execute', el.getAttribute('data-executeid'))
        }
        return () =>
            h('div', { onClick }, [slots.trigger?.({ trigger: () => {} }), slots.default?.()])
    }
})

const mountSwitch = (
    variant: 'segmented' | 'compact',
    current: 'month' | 'week' | 'day',
    onSwitch: (name: string) => void
) =>
    mount(CalendarViewSwitch, {
        props: { variant, current, onSwitch: onSwitch as never },
        global: { stubs: { 'nue-dropdown': DropdownStub, NueDropdown: DropdownStub } }
    })

afterEach(() => setLocale('zh-CN'))

describe('T445 ① CalendarViewSwitch', () => {
    it('segmented：三格 = 月/周/日，当前态高亮，点击上抛子路由名', async () => {
        const onSwitch = vi.fn()
        const w = mountSwitch('segmented', 'month', onSwitch)
        const btns = w.findAll('.cal-view-btn')
        expect(btns.map((b) => b.text())).toEqual(['月', '周', '日'])
        expect(btns[0]!.classes()).toContain('is-active')
        expect(btns[1]!.classes()).not.toContain('is-active')

        await btns[1]!.trigger('click')
        expect(onSwitch).toHaveBeenCalledWith('calendar-weekly')
        await btns[2]!.trigger('click')
        expect(onSwitch).toHaveBeenCalledWith('calendar-day')
    })

    it('segmented：当前态随 current 变化（week/day）', () => {
        const week = mountSwitch('segmented', 'week', vi.fn())
        expect(week.findAll('.cal-view-btn')[1]!.classes()).toContain('is-active')
        const day = mountSwitch('segmented', 'day', vi.fn())
        expect(day.findAll('.cal-view-btn')[2]!.classes()).toContain('is-active')
    })

    it('i18n：英文渲染 Month / Week / Day；中文 月 / 周 / 日', async () => {
        const onSwitch = vi.fn()
        const w = mountSwitch('segmented', 'month', onSwitch)
        expect(w.findAll('.cal-view-btn').map((b) => b.text())).toEqual(['月', '周', '日'])
        setLocale('en-US')
        await w.vm.$nextTick()
        expect(w.findAll('.cal-view-btn').map((b) => b.text())).toEqual(['Month', 'Week', 'Day'])
    })

    it('segmented：滑块 Tab 指示器随当前视图平移（month/week/day → 0/100%/200%）', () => {
        const month = mountSwitch('segmented', 'month', vi.fn())
        const week = mountSwitch('segmented', 'week', vi.fn())
        const day = mountSwitch('segmented', 'day', vi.fn())
        const transformOf = (w: ReturnType<typeof mountSwitch>): string =>
            (w.find('[data-testid="calendar-view-thumb"]').element as HTMLElement).style.transform
        expect(month.find('[data-testid="calendar-view-thumb"]').exists()).toBe(true)
        expect(transformOf(month)).toBe('translateX(0%)')
        expect(transformOf(week)).toBe('translateX(100%)')
        expect(transformOf(day)).toBe('translateX(200%)')
    })

    it('T448：激活色 / 槽底色 / 容器边均用既有 nue-* token，且不再依赖 --cal-*（侧栏在日历令牌组之外）', () => {
        const css = Object.values(
            import.meta.glob('../view-switch.vue', {
                query: '?raw',
                import: 'default',
                eager: true
            }) as Record<string, string>
        ).join('\n')
        // 槽底色（按钮组背景）
        expect(css).toContain(
            'background: color-mix(in srgb, var(--nue-primary-text-color) 8%, var(--nue-primary-color-0))'
        )
        // 容器边界（图形 ≥3:1）
        expect(css).toContain(
            'color-mix(in srgb, var(--nue-primary-text-color) 55%, var(--nue-primary-color-0))'
        )
        // 指示器（激活底色 = 页面底色，与槽底区分）
        expect(css).toContain('background: var(--nue-primary-color-0)')
        // 激活色 / 字重 + 未激活可辨色
        expect(css).toContain('color: var(--nue-primary-text-color)')
        expect(css).toContain('font-weight: 600')
        expect(css).toContain('color: var(--nue-secondary-text-color)')
        // 滑块动效
        expect(css).toContain('.cal-view-thumb')
        expect(css).toContain('transition: transform 180ms ease')
        expect(css).toContain('prefers-reduced-motion: reduce')
        // 根因守卫：分段控件不得再引 `--cal-*`（侧栏在日历令牌组之外 ⇒ 会全量失效）
        expect(css).not.toContain('var(--cal-')
    })

    it('compact：触发器 = 当前视图名；下拉三项 data-executeid = 子路由名', () => {
        const w = mountSwitch('compact', 'week', vi.fn())
        expect(w.find('[data-testid="calendar-view-switch-compact"]').text()).toBe('周')
        const items = w.findAll('[role="menuitem"]')
        expect(items.map((i) => i.attributes('data-executeid'))).toEqual([
            'calendar-monthly',
            'calendar-weekly',
            'calendar-day'
        ])
        expect(items[1]!.classes()).toContain('is-on')
    })

    it('compact：下拉 execute → 上抛对应子路由名', async () => {
        const onSwitch = vi.fn()
        const w = mountSwitch('compact', 'month', onSwitch)
        await w.find('[data-executeid="calendar-day"]').trigger('click')
        expect(onSwitch).toHaveBeenCalledWith('calendar-day')
    })
})