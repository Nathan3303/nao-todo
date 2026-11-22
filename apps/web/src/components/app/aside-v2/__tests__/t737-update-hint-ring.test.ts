// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick, ref } from 'vue'
import AppAsideV2Adapter from '../adapter.vue'
import { unbindRailBottomHost } from '../rail-host'
import { APP_CONTEXT_KEY } from '@/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

/**
 * T737 · 侧栏「可更新」弱提示（齿轮右上 6px 空心环，rail + 抽屉两变体）
 *
 * @description 断言的是**渲染结果**（真挂载两变体 + 打印实测标记），不是静态推断：
 *              - 只有 `hintVisible` 为真才出现环；Web（桩恒 false）⇒ 两变体都无环；
 *              - 变体互斥：抽屉形态只有 `data-update-hint="drawer"`，rail 形态只有 `"rail"`；
 *              - 弱提示同时改齿轮的可访问名（`aria-label` / `title`），不新增按钮、不扩命中区。
 *              jsdom 无布局 ⇒ 环的几何（6px / 1.5px 描边 / 无动效）按**源级样式契约**校验
 *              （与 `aside-drawer-tools.test.ts` 既有口径一致；真机观感由用户验收）。
 * @see docs/designs/358-desktop-self-update.md（§3 弱提示 / §4 token）
 * @see docs/prds/2026-11-20-desktop-self-update.md（AC10 零外溢）
 */

const mocks = vi.hoisted(() => ({
    hintVisible: { value: false },
    readCachedNickname: vi.fn()
}))

vi.mock('@nao-todo/infrastructure', () => ({
    readCachedNickname: mocks.readCachedNickname
}))

vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/session/profile-cache',
    async () => import('@nao-todo/infrastructure')
)

vi.mock('@nao-todo/presentation/pomodoro', () => ({
    PomodoroIndicator: { name: 'PomodoroIndicator', render: () => null }
}))

vi.mock('@/components/settings/dialog', async () => {
    const { defineComponent, h } = await import('vue')
    const AppSettingsDialog = defineComponent({
        name: 'AppSettingsDialogStub',
        setup: () => () => h('div', { class: 'settings-dialog-stub' })
    })
    return { AppSettingsDialog, open: ref(false), openSettingsDialog: vi.fn() }
})

/** 弱提示只读 hook：真实现的订阅/持久化由桌面端用例覆盖，这里只注入可见性 */
vi.mock('@/hooks/use-desktop-updater', async () => {
    const { computed } = await import('vue')
    return {
        useDesktopUpdater: () => ({ hintVisible: computed(() => mocks.hintVisible.value) })
    }
})

const layoutStub = { template: '<div><slot /></div>' }

const cssModules = import.meta.glob('/apps/web/src/components/app/aside-v2/aside-v2.css', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>
const asideCssNoComments = (
    cssModules['/apps/web/src/components/app/aside-v2/aside-v2.css'] ?? ''
).replace(/\/\*[\s\S]*?\*\//g, '')

const ruleBody = (selector: string): string => {
    const start = asideCssNoComments.indexOf(`${selector} {`)
    if (start < 0) return ''
    const open = start + selector.length + 2
    return asideCssNoComments.slice(open, asideCssNoComments.indexOf('}', open))
}

let wrapper: VueWrapper | null = null

const mountAdapter = (responsiveFlag: { value: number }): VueWrapper => {
    wrapper = mount(AppAsideV2Adapter, {
        attachTo: document.body,
        global: {
            plugins: [createPinia()],
            provide: {
                [APP_CONTEXT_KEY as symbol]: {
                    routerLinks: [
                        { route: '/tasks', name: '任务', icon: 'ntd-task' },
                        { route: '/calendar', name: '日历', icon: 'ntd-calendar' }
                    ],
                    responsiveFlag
                },
                [INDEX_VIEW_CONTEXT_KEY as symbol]: {
                    isDisplayAside: ref(true),
                    isUseFloatAside: ref(responsiveFlag.value <= 0),
                    switchDisplayAside: vi.fn(),
                    asideWidth: ref(300),
                    handleResizeAside: vi.fn()
                }
            },
            components: {
                'nue-aside': layoutStub,
                'nue-drawer': layoutStub,
                'nue-container': layoutStub,
                'nue-header': layoutStub,
                'nue-main': layoutStub,
                'nue-content': { template: '<div class="nue-content"><slot /></div>' },
                'nue-footer': { template: '<div class="nue-footer"><slot /></div>' },
                'nue-div': {
                    props: { theme: { type: String, default: '' } },
                    template: '<div :class="theme ? `nue-div--${theme}` : null"><slot /></div>'
                },
                'nue-text': layoutStub,
                'nue-icon': layoutStub,
                'nue-tooltip': layoutStub,
                'nue-link': { template: '<a class="stub-nav-link" />' }
            }
        }
    })
    return wrapper
}

const settle = async (): Promise<void> => {
    await nextTick()
    await nextTick()
    await flushPromises()
}

const gear = (id: string): HTMLButtonElement => document.getElementById(id) as HTMLButtonElement

const rings = (): HTMLElement[] => Array.from(document.querySelectorAll('.aside-gear-btn__ring'))

beforeEach(() => {
    mocks.hintVisible.value = false
    mocks.readCachedNickname.mockReturnValue(null)
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    unbindRailBottomHost()
    document.body.innerHTML = ''
})

describe('T737 · 侧栏弱提示：可见性由 hook 决定（Web 恒不渲染）', () => {
    it('抽屉形态：hintVisible=false ⇒ 无环、齿轮可访问名为「设置」', async () => {
        mountAdapter(ref(0))
        await settle()

        expect(rings()).toHaveLength(0)
        expect(gear('AppAsideDrawerSettingsGearBtn').getAttribute('aria-label')).toBe('设置')
    })

    it('抽屉形态：hintVisible=true ⇒ 环出现（data-update-hint="drawer"）且可访问名带「有可用更新」', async () => {
        mocks.hintVisible.value = true
        mountAdapter(ref(0))
        await settle()

        const found = rings()
        expect(found).toHaveLength(1)
        expect(found[0]?.getAttribute('data-update-hint')).toBe('drawer')
        expect(gear('AppAsideDrawerSettingsGearBtn').getAttribute('aria-label')).toBe(
            '设置 · 有可用更新'
        )
        expect(gear('AppAsideDrawerSettingsGearBtn').getAttribute('title')).toBe(
            '设置 · 有可用更新'
        )
        // 环是无障碍装饰：⛔ 不新增可聚焦元素、不进入读屏
        expect(found[0]?.getAttribute('aria-hidden')).toBe('true')
        expect(found[0]?.tagName).toBe('SPAN')
    })

    it('rail 形态：hintVisible=true ⇒ 环出现（data-update-hint="rail"），抽屉变体不渲染', async () => {
        mocks.hintVisible.value = true
        mountAdapter(ref(4))
        await settle()

        const found = rings()
        expect(found).toHaveLength(1)
        expect(found[0]?.getAttribute('data-update-hint')).toBe('rail')
        expect(document.getElementById('AppAsideDrawerSettingsGearBtn')).toBeNull()
        expect(gear('AppAsideSettingsGearBtn').getAttribute('aria-label')).toBe('设置 · 有可用更新')
    })

    it('rail 形态：hintVisible=false ⇒ 无环（环不常驻）', async () => {
        mountAdapter(ref(4))
        await settle()
        expect(rings()).toHaveLength(0)
    })
})

describe('T737 · 弱提示样式契约（源级：jsdom 无布局）', () => {
    it('6px 空心环：1.5px 描边、圆形、无填充色块、无动效', () => {
        const body = ruleBody('.aside-gear-btn__ring')
        expect(body).not.toBe('')
        expect(body).toContain('width: 6px')
        expect(body).toContain('height: 6px')
        expect(body).toContain('border: 1.5px solid var(--nue-secondary-text-color)')
        expect(body).toContain('border-radius: 50%')
        expect(body).not.toContain('animation')
        expect(body).not.toContain('transition')
    })

    it('用 W3C 角标定位在齿轮右上（外扩 1px），不扩大命中区', () => {
        const body = ruleBody('.aside-gear-btn__ring')
        expect(body).toContain('position: absolute')
        expect(body).toContain('top: -1px')
        expect(body).toContain('right: -1px')
        expect(body).toContain('pointer-events: none')
    })
})