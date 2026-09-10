// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { ref } from 'vue'
import { NueAside, NueAvatar, NueDiv, NueIcon, NueSeparator, NueText, NueTooltip } from 'nue-ui'
import AsideV2 from './aside-v2.vue'
import { APP_CONTEXT_KEY } from '@/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

/**
 * 壳离线降级断言（SHELL-03 C-03/C-05/C-18、BC-5）
 * @description profile 为空（离线 profile 加载失败）时，轨道 / 导航 / 齿轮 / SHELL-02 注入点
 *              必须**照常渲染**，身份区仅为装饰占位（缓存首字母 → 通用图标），不阻塞壳。
 * @see docs/adr/2026-09-10-shell-03-offline-availability.md
 */

const mocks = vi.hoisted(() => ({
    readCachedNickname: vi.fn()
}))

// 只保留本组件链上真正需要的导出：避免把设置对话框/番茄指示器的重图拉进测试
vi.mock('@nao-todo/infrastructure', () => ({
    readCachedNickname: mocks.readCachedNickname
}))

vi.mock('@nao-todo/presentation/pomodoro', () => ({
    PomodoroIndicator: { name: 'PomodoroIndicator', render: () => null }
}))

vi.mock('@/components/settings/dialog', async () => {
    const { ref } = await import('vue')
    return {
        AppSettingsDialog: { name: 'AppSettingsDialog', render: () => null },
        open: ref(false),
        openSettingsDialog: vi.fn()
    }
})

let wrapper: VueWrapper | null = null

const mountAside = (): VueWrapper => {
    wrapper = mount(AsideV2, {
        attachTo: document.body,
        global: {
            plugins: [createPinia()],
            provide: {
                [APP_CONTEXT_KEY as symbol]: {
                    routerLinks: [
                        { route: '/tasks', name: '任务', icon: 'ntd-task' },
                        { route: '/calendar', name: '日历', icon: 'ntd-calendar' }
                    ]
                },
                [INDEX_VIEW_CONTEXT_KEY as symbol]: {
                    isDisplayAside: ref(true),
                    isUseFloatAside: ref(false),
                    switchDisplayAside: vi.fn(),
                    asideWidth: ref(300),
                    handleResizeAside: vi.fn()
                }
            },
            components: {
                'nue-aside': NueAside,
                'nue-avatar': NueAvatar,
                'nue-div': NueDiv,
                'nue-icon': NueIcon,
                'nue-separator': NueSeparator,
                'nue-text': NueText,
                'nue-tooltip': NueTooltip
            },
            stubs: {
                'nao-router-link': { template: '<a class="stub-nav-link" />' }
            }
        }
    })
    return wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.readCachedNickname.mockReturnValue(null)
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('AppAsideV2 - SHELL-03 壳离线降级（BC-5）', () => {
    it('BC-5：profile 为空 ⇒ 轨道/导航/齿轮/SHELL-02 注入点照常渲染', async () => {
        const aside = mountAside()
        await flushPromises()

        expect(aside.find('.nue-div--mainly-aside').exists()).toBe(true)
        expect(aside.find('#AppAsideRailBottomSlot').exists()).toBe(true)
        expect(aside.find('#AppAsideSettingsGearBtn').exists()).toBe(true)
        expect(aside.findAll('.stub-nav-link').length).toBe(2)
        // 身份区仅为装饰占位：无缓存 ⇒ 通用图标回落，不空白、不阻塞
        expect(aside.find('.nue-avatar__icon').exists()).toBe(true)
        expect(aside.find('.initial-avatar__text').exists()).toBe(false)
    })

    it('C-18：离线命中缓存 ⇒ 首字母头像 + title/aria-label（轨道不放可见小字）', async () => {
        mocks.readCachedNickname.mockReturnValue('张三')
        const aside = mountAside()
        await flushPromises()

        expect(aside.find('.initial-avatar__text').text()).toBe('张')
        const root = aside.find('.initial-avatar')
        expect(root.attributes('title')).toBe('张三（离线）')
        expect(root.attributes('aria-label')).toBe('张三（离线）')
        // 轨道 70px 内不得出现可见「离线」小字（C-18 末条）
        expect(aside.text()).not.toContain('离线')
    })
})