// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick, ref, type Ref } from 'vue'
import { nueUI } from '@/nue-ui-register'
import SettingsDialog from '../index.vue'
import { unbindSettingsDialogHost } from '../state'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

/**
 * T521-R1 形态 A：窄屏（Float 变体 / ≤445px）三区入口复用 `segmented-switch`
 * @description R1 取代 R0 的自写 ghost 按钮行：窄屏用单一来源分段件（三段等分 / 纯文字 /
 *              `role=group` + `aria-pressed`），桌面（>445px）仍 `tablist` + 左栏纵排（逐字不变）。
 *              窄屏判定 = `isUseFloatAside`（与抽屉同一 445px 阈值，无新魔法数）
 *              ⇒ 断言两者同时切换；另加源级断言：窄屏块内不再有自写分段样式。
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

/** 设置对话框源文本（源级断言：窄屏不再自写分段样式） */
const sourceModules = import.meta.glob<string>(
    '/apps/web/src/components/settings/dialog/index.vue',
    { query: '?raw', import: 'default', eager: true }
)
const dialogSource = (): string => {
    const values = Object.values(sourceModules)
    expect(values.length).toBe(1)
    return values[0]!
}

let wrapper: VueWrapper | null = null

const mountDialog = (isUseFloatAside: Ref<boolean>): VueWrapper => {
    wrapper = mount(SettingsDialog, {
        global: {
            plugins: [createPinia(), nueUI],
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
                'nue-dialog': NueDialogStub
            }
        }
    })
    return wrapper
}

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    unbindSettingsDialogHost()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('T521-R1 设置对话框窄屏形态 A（复用 segmented-switch）', () => {
    it('桌面（>445px）：仍 tablist + 左栏纵排，不渲染分段件', async () => {
        mountDialog(ref(false))
        await nextTick()

        const root = wrapper!.find('.nue-dialog').element as HTMLElement
        expect(root.classList.contains('nue-dialog--settings')).toBe(true)
        expect(root.classList.contains('is-narrow')).toBe(false)
        // 桌面语义与结构逐字不变
        const tablist = wrapper!.find('[role="tablist"]')
        expect(tablist.exists()).toBe(true)
        expect(tablist.attributes('aria-orientation')).toBe('vertical')
        expect(wrapper!.findAll('[role="tab"]').length).toBe(3)
        expect(wrapper!.find('.sd-tabs').exists()).toBe(true)
        // 窄屏件不渲染 ⇒ 不会出现两套语义并存
        expect(wrapper!.find('.segmented-toggle').exists()).toBe(false)
    })

    it('窄屏（≤445px）：渲染 segmented-switch（3 段 / fill / 纯文字 / group+aria-pressed），无 tablist', async () => {
        const isUseFloatAside = ref(false)
        mountDialog(isUseFloatAside)
        await nextTick()
        expect(wrapper!.find('.segmented-toggle').exists()).toBe(false)

        isUseFloatAside.value = true
        await nextTick()

        const root = wrapper!.find('.nue-dialog').element as HTMLElement
        expect(root.classList.contains('is-narrow')).toBe(true)

        // 单一语义：只有 group，没有 tablist / tab
        expect(wrapper!.find('[role="tablist"]').exists()).toBe(false)
        expect(wrapper!.find('[role="tab"]').exists()).toBe(false)

        const group = wrapper!.find('.segmented-toggle')
        expect(group.exists()).toBe(true)
        expect(group.attributes('role')).toBe('group')
        expect(group.attributes('aria-label')).toBe('设置分区')
        // fill（三段等分铺满内容宽度）
        expect(group.classes()).toContain('is-fill')

        const segments = wrapper!.findAll('.segmented-btn')
        expect(segments.length).toBe(3)
        // 纯文字（无图标）、窄屏短标签（4 字 ⇒ 320px 档不裁字）
        expect(segments.map((s) => s.text())).toEqual(['用户信息', '密码修改', '应用设置'])
        expect(wrapper!.findAll('.segmented-btn .nue-icon').length).toBe(0)
        // a11y：aria-pressed 随选中态（默认首段）
        expect(segments.map((s) => s.attributes('aria-pressed'))).toEqual([
            'true',
            'false',
            'false'
        ])
        // 自写左栏分区条已不再渲染
        expect(wrapper!.find('.sd-tabs').exists()).toBe(false)
    })

    it('窄屏：点第三段 ⇒ 切换当前区（aria-pressed 迁移；仍只有一套语义）', async () => {
        mountDialog(ref(true))
        await nextTick()

        const segments = wrapper!.findAll('.segmented-btn')
        await segments[2]!.trigger('click')
        await nextTick()

        const after = wrapper!.findAll('.segmented-btn')
        expect(after.map((s) => s.attributes('aria-pressed'))).toEqual(['false', 'false', 'true'])
        expect(wrapper!.find('[role="tablist"]').exists()).toBe(false)
    })

    it('源级：窄屏块内无自写分段样式（sd-tabs / sd-tab / max-content / nowrap / 动态 aria-orientation）', () => {
        const source = dialogSource()
        const narrowBlocks = source
            .split('.is-narrow')
            .slice(1)
            .map((chunk) => chunk.slice(0, chunk.indexOf('}') + 1))
            .join('\n')

        expect(narrowBlocks).not.toBe('')
        expect(narrowBlocks).not.toContain('sd-tabs')
        expect(narrowBlocks).not.toContain('sd-tab')
        expect(narrowBlocks).not.toContain('max-content')
        expect(narrowBlocks).not.toContain('nowrap')
        expect(narrowBlocks).not.toContain('tablist')
        // 桌面 tablist 的 aria-orientation 固定 vertical（不再随窄屏切成 horizontal）
        expect(source).not.toContain("'horizontal'")
    })
})