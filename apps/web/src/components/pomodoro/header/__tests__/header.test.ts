// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import { nueUI } from '@/nue-ui-register'
import pomodoroRoutes from '@/views/index/pomodoro/routes'
import PomodoroHeader from '../header.vue'

/**
 * T452 「番茄专注 / 正计时」头部悬浮化
 * @description 仅 route.name='pomodoro'（timer/focus）两页去底边 + 透明底；
 *              「常用专注 / 专注记录」保持原样（含底边）；标题/按钮结构不变。
 */

const stub = { template: '<div />' }
const withStubComponents = (route: RouteRecordRaw): RouteRecordRaw =>
    ({
        ...route,
        component: stub,
        ...(route.children ? { children: route.children.map(withStubComponents) } : {})
    }) as RouteRecordRaw

const buildRouter = () =>
    createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/', component: stub, children: [withStubComponents(pomodoroRoutes)] }]
    })

let wrapper: VueWrapper | null = null
afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const mountHeader = async (path: string) => {
    const router = buildRouter()
    await router.push(path)
    await router.isReady()
    wrapper = mount(PomodoroHeader, {
        global: {
            plugins: [nueUI, router],
            provide: {
                [POMODORO_VIEW_CONTEXT_KEY as symbol]: {
                    isDisplayAside: ref(false),
                    switchDisplayAside: () => {}
                }
            }
        }
    })
    await flushPromises()
    return wrapper
}

const headerEl = (): HTMLElement => wrapper!.find('.nue-header').element as HTMLElement

describe('T452 番茄专注 / 正计时 头部悬浮（去底边）', () => {
    it('timer 页：头部带悬浮类、内联无底边、透明底', async () => {
        await mountHeader('/pomodoro/timer')
        const el = headerEl()
        expect(el.classList.contains('pomodoro-header--floating')).toBe(true)
        expect(el.style.borderBottomStyle).toBe('none')
        expect(el.style.backgroundColor === 'transparent' || el.style.backgroundColor === '').toBe(
            true
        )
    })

    it('focus 页：同样悬浮', async () => {
        await mountHeader('/pomodoro/focus')
        expect(headerEl().classList.contains('pomodoro-header--floating')).toBe(true)
        expect(headerEl().style.borderBottomStyle).toBe('none')
    })

    it('常用专注 / 专注记录页：保持原样（无悬浮类、无内联无底边）', async () => {
        await mountHeader('/pomodoro/pomodoros')
        expect(headerEl().classList.contains('pomodoro-header--floating')).toBe(false)
        expect(headerEl().style.borderBottomStyle).toBe('')

        wrapper!.unmount()
        await mountHeader('/pomodoro/records')
        expect(headerEl().classList.contains('pomodoro-header--floating')).toBe(false)
        expect(headerEl().style.borderBottomStyle).toBe('')
    })

    it('头部功能结构不变：汉堡开关 + 页面标题仍在', async () => {
        await mountHeader('/pomodoro/timer')
        expect(wrapper!.find('.nue-header').exists()).toBe(true)
        expect(wrapper!.text()).toContain('番茄专注')
        expect(wrapper!.find('button').exists()).toBe(true)
    })

    it('源级：悬浮类为「真悬浮」（绝对定位移出文档流 + 透明底 + 点击穿透）', () => {
        const css = Object.values(
            import.meta.glob('../header.vue', {
                query: '?raw',
                import: 'default',
                eager: true
            }) as Record<string, string>
        ).join('\n')
        const flat = css.replace(/\s+/g, ' ')
        const rule = /\.pomodoro-header--floating \{ ([^}]*) \}/.exec(flat)?.[1] ?? ''
        expect(rule).toContain('position: absolute')
        expect(rule).toContain('top: 0')
        expect(rule).toContain('background-color: transparent')
        expect(rule).toContain('pointer-events: none')
        // 下方元素不受头部高度影响 ⇒ 头部不得保留 static/relative 占位
        expect(rule).not.toContain('position: relative')
    })
})