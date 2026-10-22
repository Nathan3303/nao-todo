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

/** 分段件源文本（R2：尺寸走件内 `size` 轴；长标签换行不截断的 CSS 契约） */
const switchModules = import.meta.glob<string>(
    '/apps/web/src/components/calendar/segmented-switch.vue',
    { query: '?raw', import: 'default', eager: true }
)
const switchSource = (): string => {
    const values = Object.values(switchModules)
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
        // R4：标识载体是我们自己的 wrapper（桌面不带）
        expect(wrapper!.find('.sd-body').classes()).not.toContain('is-narrow')
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

        // R4：`.nue-dialog` 的 class 由 NueDialog 内部重组、根是 Teleport ⇒ 外部 class 被丢弃，
        // 因此窄屏标识**不得**出现在 `.nue-dialog` 上，而必须落在自有 wrapper `.sd-body` 上
        const root = wrapper!.find('.nue-dialog').element as HTMLElement
        expect(root.classList.contains('is-narrow')).toBe(false)
        expect(wrapper!.find('.sd-body').classes()).toContain('is-narrow')

        // 单一语义：只有 group，没有 tablist / tab
        expect(wrapper!.find('[role="tablist"]').exists()).toBe(false)
        expect(wrapper!.find('[role="tab"]').exists()).toBe(false)

        const group = wrapper!.find('.segmented-toggle')
        expect(group.exists()).toBe(true)
        expect(group.attributes('role')).toBe('group')
        expect(group.attributes('aria-label')).toBe('设置分区')
        // fill（三段等分铺满内容宽度）+ 尺寸轴 md（点击区 ≈40px，走件内 size，不在调用处覆盖）
        expect(group.classes()).toContain('is-fill')
        expect(group.classes()).toContain('is-md')

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

    it('R4 落点与结构：窄屏 Tab 与面板同父级（.sd-body），纵向堆叠载体在窄屏成立', async () => {
        const isUseFloatAside = ref(false)
        mountDialog(isUseFloatAside)
        await nextTick()

        // 桌面：左栏与面板也同在 .sd-body（布局载体），且 .sd-body 为 row
        const body = wrapper!.find('.sd-body')
        expect(body.exists()).toBe(true)
        expect(body.classes()).not.toContain('is-narrow')
        expect(body.find('.sd-tabs').exists()).toBe(true)
        expect(body.find('.sd-panel').exists()).toBe(true)

        isUseFloatAside.value = true
        await nextTick()

        const narrowBody = wrapper!.find('.sd-body')
        expect(narrowBody.classes()).toContain('is-narrow')
        // Tab（分段件）与面板必须同父级 = .sd-body（否则 row/column 样式作用不到一对子元素）
        const segmented = narrowBody.find('.segmented-toggle')
        const panel = narrowBody.find('.sd-panel')
        expect(segmented.exists()).toBe(true)
        expect(panel.exists()).toBe(true)
        expect(segmented.element.parentElement).toBe(narrowBody.element)
        expect(panel.element.parentElement).toBe(narrowBody.element)
        // 分段件在前（Tab 在上）、面板在后（主体在下）
        expect(
            segmented.element.compareDocumentPosition(panel.element) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
        // 标识不再挂在 dialog 上（R4 回归护栏）
        expect(wrapper!.find('.nue-dialog').classes()).not.toContain('is-narrow')
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

    it('中英分语言口径（AC3）：长标签允许换行增高、不 ellipsis / 不 nowrap；调用处不覆盖分段尺寸', () => {
        const seg = switchSource()
        // 件内：可换行 + 高度随内容（min-height 承载 size 轴）⇒ 英文 2 行不被裁
        expect(seg).toContain('white-space: normal')
        expect(seg).toContain('height: auto')
        expect(seg).toContain('min-height: var(--nue-box-size-xs)')
        expect(seg).toContain('min-height: var(--nue-box-size-md)')
        expect(seg).not.toContain('text-overflow')
        expect(seg).not.toContain('white-space: nowrap')

        // 调用处：只传 size="md"，不写任何分段件选择器（R2：尺寸不得在调用处覆盖）
        const dialog = dialogSource()
        expect(dialog).toContain('size="md"')
        expect(dialog).not.toContain('.segmented-btn')
        expect(dialog).not.toContain('.segmented-toggle')
    })

    it('源级 R4：标识挂在自有 wrapper（.sd-body.is-narrow）且无「挂在 dialog 上」的死选择器', () => {
        const source = dialogSource()
        // 模板：wrapper 承载 is-narrow；<nue-dialog> 上不得再写 :class 绑定
        expect(source).toMatch(/class="sd-body"\s+:class="\{ 'is-narrow': isNarrow \}"/)
        expect(source).not.toMatch(/<nue-dialog[^>]*:class=/)

        // 样式：竖向堆叠与面板高度挂在 wrapper 上
        expect(source).toMatch(/\.sd-body\s*\{[^}]*display:\s*flex/)
        expect(source).toMatch(/\.sd-body\s*\{[^}]*flex-direction:\s*row/)
        expect(source).toMatch(/\.sd-body\s*\{[^}]*flex:\s*1\s+1\s+auto/)
        expect(source).toMatch(/\.sd-body\s*\{[^}]*min-height:\s*0/)
        expect(source).toMatch(/\.sd-body\.is-narrow\s*\{[^}]*flex-direction:\s*column/)
        expect(source).toMatch(/\.sd-body\.is-narrow\s+\.sd-panel\s*\{[^}]*flex:\s*1\s+1\s+auto/)

        // 死选择器必须绝迹（只看 <style> 块：模板注释里为留痕会引用该写法）
        const style = source.slice(source.indexOf('<style>'), source.lastIndexOf('</style>'))
        expect(style).not.toContain('.nue-dialog--settings.is-narrow')
        expect(style).toContain('.sd-body.is-narrow')
        // 所有含 `.is-narrow` 的选择器都必须以 `.sd-body` 打头（= 标识载体只有 wrapper）
        const narrowSelectors = [...style.matchAll(/([^\n{}]*\.is-narrow[^\n{}]*)\{/g)].map((m) =>
            m[1]!.trim()
        )
        expect(narrowSelectors.length).toBeGreaterThan(0)
        for (const selector of narrowSelectors) {
            expect(
                selector.split(',').map((part) => part.trim()),
                `窄屏选择器未挂在 .sd-body 上：${selector}`
            ).toEqual(selector.split(',').map(() => expect.stringMatching(/^\.sd-body/)))
        }
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
        // R2：窄屏块只剩容器堆叠，不再有任何分段件尺寸覆盖
        expect(narrowBlocks).not.toContain('segmented-btn')
        // 桌面 tablist 的 aria-orientation 固定 vertical（不再随窄屏切成 horizontal）
        expect(source).not.toContain("'horizontal'")
    })
})