// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick, ref, type Ref } from 'vue'
import SettingsDialog from '../index.vue'
import { unbindSettingsDialogHost } from '../state'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

/**
 * T521 形态 A：设置对话框窄屏（Float 变体 / ≤445px）三区入口改顶部横向 Tab
 * @description 窄屏判定直接复用 `isUseFloatAside`（与抽屉变体同一阈值 445px）⇒ 断言两者同时切换；
 *              桌面（false）不命中 ⇒ 左栏纵排与 `aria-orientation="vertical"` 不变（AC4/AC5）。
 */

vi.mock('@/hooks', () => ({
    useAuthUseCase: () => ({}),
    useUserUseCase: () => ({})
}))

vi.mock('@nao-todo/presentation-identity', () => ({
    useUserStore: () => ({ profile: null })
}))

vi.mock('@/components/settings/profile-updater', () => ({
    SettingsProfileUpdater: {
        name: 'SettingsProfileUpdaterStub',
        render: () => null
    }
}))
vi.mock('@/components/settings/password-updater', () => ({
    SettingsPasswordUpdater: {
        name: 'SettingsPasswordUpdaterStub',
        render: () => null
    }
}))
vi.mock('@/components/settings/app-setter', () => ({
    SettingsAppSetter: { name: 'SettingsAppSetterStub', render: () => null }
}))

/** nue-dialog stub：theme → `.nue-dialog--<theme>` 类（承接组件内向根节点追加的 class 与 a11y 断言） */
const NueDialogStub = {
    props: ['modelValue', 'title', 'theme'],
    template:
        '<div class="nue-dialog" :class="String(theme).split(\',\').map((t) => `nue-dialog--${t}`)"><slot /></div>'
}

let wrapper: VueWrapper | null = null

const mountDialog = (isUseFloatAside: Ref<boolean>): VueWrapper => {
    wrapper = mount(SettingsDialog, {
        global: {
            plugins: [createPinia()],
            provide: {
                [INDEX_VIEW_CONTEXT_KEY as symbol]: {
                    appSubscriber: {},
                    appDialogManager: {},
                    isDisplayAside: ref(true),
                    isUseFloatAside,
                    switchDisplayAside: vi.fn()
                }
            },
            components: {
                'nue-dialog': NueDialogStub,
                'nue-button': { template: '<button><slot /></button>' },
                'nue-icon': { template: '<i />' }
            }
        }
    })
    return wrapper
}

const tablist = (): HTMLElement =>
    wrapper!.find('[role="tablist"]').element as unknown as HTMLElement

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    unbindSettingsDialogHost()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('T521 设置对话框形态 A（窄屏顶部横向 Tab）', () => {
    it('桌面（>445px）：不命中 is-narrow，左栏纵排语义不变', async () => {
        mountDialog(ref(false))
        await nextTick()

        const root = wrapper!.find('.nue-dialog').element as HTMLElement
        expect(root.classList.contains('nue-dialog--settings')).toBe(true)
        expect(root.classList.contains('is-narrow')).toBe(false)
        expect(tablist().getAttribute('aria-orientation')).toBe('vertical')
        expect(wrapper!.findAll('[role="tab"]').length).toBe(3)
    })

    it('窄屏（≤445px / Float 变体）：命中 is-narrow，三区入口横排可点（aria-orientation 同步）', async () => {
        const isUseFloatAside = ref(false)
        mountDialog(isUseFloatAside)
        await nextTick()
        expect(tablist().getAttribute('aria-orientation')).toBe('vertical')

        isUseFloatAside.value = true
        await nextTick()

        const root = wrapper!.find('.nue-dialog').element as HTMLElement
        expect(root.classList.contains('is-narrow')).toBe(true)
        expect(tablist().getAttribute('aria-orientation')).toBe('horizontal')
        // 三区入口齐全（三区标题走既有 i18n 键，横排仍完整可读）
        const labels = wrapper!.findAll('[role="tab"]').map((tab) => tab.text())
        expect(labels).toEqual(['账户与个人信息', '密码与安全', '应用设置'])
    })
})