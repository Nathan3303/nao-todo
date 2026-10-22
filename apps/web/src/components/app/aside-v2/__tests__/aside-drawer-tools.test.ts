// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick, ref } from 'vue'
import AppAsideV2Adapter from '../adapter.vue'
import { railBottomHost, railBottomHostVariant, unbindRailBottomHost } from '../rail-host'
import { APP_CONTEXT_KEY } from '@/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

/**
 * T521 抽屉工具区（同步状态 + 设置入口）与变体互斥断言
 * @description AC1（抽屉内两件套可见、齿轮直开设置）· AC4（切变体不重复宿主 / 不重复对话框实例、
 *              桌面 rail 注入点照常绑定）· AC6（宿主绑定-解绑、单实例、齿轮焦点归还当前可见变体）。
 *              布局原语用轻量 stub ⇒ 断言聚焦在「绑定关系 / 实例数 / 顺序」，不测 nue-ui 内部。
 * @see docs/prds/2026-10-22-aside-drawer-sync-and-settings.md
 */

const mocks = vi.hoisted(() => ({
    readCachedNickname: vi.fn(),
    openSettingsDialog: vi.fn(),
    open: null as unknown as { value: boolean },
    dialogMounted: 0
}))

// 只保留本组件链上真正需要的导出：避免把设置对话框/番茄指示器的重图拉进测试
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

// 设置对话框替换为可计数的 stub：单实例断言靠 mounted 计数（AC6 ②）
vi.mock('@/components/settings/dialog', async () => {
    const { defineComponent, h, onMounted, onUnmounted, ref } = await import('vue')
    const open = ref(false)
    mocks.open = open
    const AppSettingsDialog = defineComponent({
        name: 'AppSettingsDialogStub',
        setup() {
            onMounted(() => {
                mocks.dialogMounted += 1
            })
            onUnmounted(() => {
                mocks.dialogMounted -= 1
            })
            return () => h('div', { class: 'settings-dialog-stub' })
        }
    })
    return {
        AppSettingsDialog,
        open,
        openSettingsDialog: mocks.openSettingsDialog
    }
})

/**
 * 布局原语 stub（attrs/插槽透传 ⇒ 断言只看本组件产出的结构与顺序）
 */
const layoutStub = { template: '<div><slot /></div>' }

/**
 * T522 抽屉工具带的**源级样式契约**（jsdom 无布局 ⇒ 只能读规则本体；真机几何由回执给实测）
 * @see docs/prds/2026-10-22-drawer-tools-row.md（§三 范围 1/4/5）
 */
const cssModules = import.meta.glob('/apps/web/src/components/app/aside-v2/aside-v2.css', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>
const asideCss = cssModules['/apps/web/src/components/app/aside-v2/aside-v2.css'] ?? ''
/** 去注释后的 CSS：注释里出现的 `.aside-gear-btn` 之类文本会污染正则/选择器扫描 */
const asideCssNoComments = asideCss.replace(/\/\*[\s\S]*?\*\//g, '')

/** 取指定选择器（逐字匹配 `选择器 {`）的首个规则体 */
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
                // footer 带真实 class：T522-R4 断言「齿轮落在 nue-footer 内」
                'nue-footer': { template: '<div class="nue-footer"><slot /></div>' },
                // nue-div 按 theme 产出 `nue-div--<theme>`（与库一致）⇒ 结构断言可用真实类名
                'nue-div': {
                    props: { theme: { type: String, default: '' } },
                    template: '<div :class="theme ? `nue-div--${theme}` : null"><slot /></div>'
                },
                'nue-text': layoutStub,
                'nue-icon': layoutStub,
                'nue-tooltip': layoutStub,
                'nao-router-link': { template: '<a class="stub-nav-link" />' }
            }
        }
    })
    return wrapper
}

/** 切变体后等两轮提交（子组件卸载/挂载 + 函数 ref 改绑） */
const settle = async (): Promise<void> => {
    await nextTick()
    await nextTick()
    await flushPromises()
}

const gearButtons = (): HTMLButtonElement[] =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('.aside-gear-btn'))

beforeEach(() => {
    vi.clearAllMocks()
    mocks.readCachedNickname.mockReturnValue(null)
    mocks.dialogMounted = 0
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    unbindRailBottomHost()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('T521 抽屉工具区：同步状态 + 设置入口', () => {
    it('AC1：抽屉底部渲染工具区，同步宿主在齿轮上方且已绑定（变体 drawer）', async () => {
        mountAdapter(ref(0))
        await settle()

        const drawerHost = document.getElementById('AppAsideDrawerBottomSlot')
        expect(drawerHost).toBeTruthy()
        // 宿主注册表指向抽屉注入点（SyncStatusBar 的 Teleport 目标）
        expect(railBottomHost.value).toBe(drawerHost)
        expect(railBottomHostVariant.value).toBe('drawer')
        // 桌面 rail 注入点不存在（变体互斥 ⇒ 同一时刻仅一个宿主）
        expect(document.getElementById('AppAsideRailBottomSlot')).toBeNull()

        const gear = document.getElementById('AppAsideDrawerSettingsGearBtn')
        expect(gear).toBeTruthy()
        // 齿轮在同步宿主之后（语义顺序：同步状态在上）
        expect(
            drawerHost!.compareDocumentPosition(gear!) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
    })

    it('AC1/AC5：齿轮 a11y 齐备 + 点击直开设置（走 hostReady 闸门入口）', async () => {
        mountAdapter(ref(0))
        await settle()

        const gear = document.getElementById('AppAsideDrawerSettingsGearBtn')!
        expect(gear.getAttribute('aria-label')).toBe('设置')
        expect(gear.getAttribute('title')).toBe('设置')

        gear.click()
        await settle()
        expect(mocks.openSettingsDialog).toHaveBeenCalledTimes(1)
    })

    it('AC5：关窗后焦点归还当前可见变体的齿轮（抽屉 → 桌面 rail）', async () => {
        const responsiveFlag = ref(0)
        mountAdapter(responsiveFlag)
        await settle()

        const open = mocks.open as { value: boolean }
        open.value = true
        await settle()
        open.value = false
        await settle()
        expect(document.activeElement).toBe(
            document.getElementById('AppAsideDrawerSettingsGearBtn')
        )

        responsiveFlag.value = 4
        await settle()
        open.value = true
        await settle()
        open.value = false
        await settle()
        expect(document.activeElement).toBe(document.getElementById('AppAsideSettingsGearBtn'))
        // 当前只保留可见变体的齿轮（另一个已卸载）
        expect(gearButtons().length).toBe(1)
    })

    it('AC6 ①：抽屉卸载 ⇒ 宿主解绑（不残留指向脱文档元素）', async () => {
        mountAdapter(ref(0))
        await settle()
        expect(railBottomHost.value).not.toBeNull()

        wrapper!.unmount()
        wrapper = null
        await settle()

        expect(railBottomHost.value).toBeNull()
        expect(railBottomHostVariant.value).toBeNull()
    })
})

describe('T521 变体切换：单一宿主 / 单实例（AC4）', () => {
    it('抽屉 → 桌面 rail：宿主改绑、对话框仍为 1 个实例、齿轮唯一', async () => {
        const responsiveFlag = ref(0)
        mountAdapter(responsiveFlag)
        await settle()

        const drawerHost = document.getElementById('AppAsideDrawerBottomSlot')
        expect(railBottomHost.value).toBe(drawerHost)
        expect(mocks.dialogMounted).toBe(1)

        responsiveFlag.value = 4
        await settle()

        const railHost = document.getElementById('AppAsideRailBottomSlot')
        expect(railHost).toBeTruthy()
        expect(document.getElementById('AppAsideDrawerBottomSlot')).toBeNull()
        expect(railBottomHost.value).toBe(railHost)
        expect(railBottomHostVariant.value).toBe('rail')
        // 无重复宿主 / 无重复对话框实例
        expect(document.querySelectorAll('.settings-dialog-stub').length).toBe(1)
        expect(mocks.dialogMounted).toBe(1)
        expect(gearButtons().length).toBe(1)
        expect(document.getElementById('AppAsideSettingsGearBtn')).toBeTruthy()
    })

    it('桌面 rail → 抽屉：反向同样成立（宿主改绑、单实例）', async () => {
        const responsiveFlag = ref(4)
        mountAdapter(responsiveFlag)
        await settle()
        expect(railBottomHostVariant.value).toBe('rail')

        responsiveFlag.value = 0
        await settle()

        expect(railBottomHost.value).toBe(document.getElementById('AppAsideDrawerBottomSlot'))
        expect(railBottomHostVariant.value).toBe('drawer')
        expect(document.querySelectorAll('.settings-dialog-stub').length).toBe(1)
        expect(mocks.dialogMounted).toBe(1)
        expect(gearButtons().length).toBe(1)
    })
})

describe('T522-R4 抽屉结构：吸底工具带 + footer 齿轮（AC1 / AC6 ②）', () => {
    it('AC1：工具带吸底（sticky bottom:0 / 48px / 左右 16px）+ 保留 1px 上分割线', () => {
        const body = ruleBody('.nue-div.nue-div--aside__tools')
        expect(body).not.toBe('')
        expect(body).toContain('position: sticky')
        expect(body).toContain('bottom: 0')
        expect(body).toContain('height: 48px')
        // R4 用户版：用户写的是 `--nue-gap-df`（与 `--nue-padding-df` 同为 16px）；按实际断言
        expect(body).toContain('padding: 0 var(--nue-gap-df)')
        expect(body).toContain('border-top: 1px solid var(--nue-border-color)')
        // 仍是一行（不换行；防回归为 wrap）
        expect(body).toContain('flex-direction: row')
        expect(body).toContain('justify-content: space-between')
        expect(body).not.toContain('flex-wrap: wrap')
    })

    it('AC1：content 区为「内容 + 吸底条」提供空间（relative + space-between + min-height: 100%）', () => {
        const body = ruleBody('#AppAsideContainer > .nue-main > .nue-content')
        expect(body).toContain('flex-direction: column')
        expect(body).toContain('position: relative')
        expect(body).toContain('justify-content: space-between')
        expect(body).toContain('min-height: 100%')
    })

    it('AC3：状态触发器仍可收缩（flex: 1 1 auto + min-width: 0）⇒ 长文案末尾省略', () => {
        const wrapper = ruleBody('.nue-div--aside__tools .nue-dropdown-wrapper')
        expect(wrapper).toContain('flex: 1 1 auto')
        expect(wrapper).toContain('min-width: 0')
    })

    it('AC1：同步状态触发器点击区仍 ≥40px；齿轮按 R4 例外不再有 40px 命中盒', () => {
        const syncBtn = ruleBody('.nue-div--aside__tools .sync-rail-btn')
        expect(syncBtn).toContain('min-width: var(--nue-box-size-md)')
        expect(syncBtn).toContain('min-height: var(--nue-box-size-md)')

        // 齿轮已移入 footer：抽屉内任何 `.aside-gear-btn` 规则都不得再施加 40px 命中盒
        const gearRules = Array.from(
            asideCssNoComments.matchAll(/\.aside-gear-btn[^{]*\{([^}]*)\}/g)
        ).map((m) => m[1])
        expect(gearRules.length).toBeGreaterThan(0)
        for (const rule of gearRules) {
            expect(rule).not.toContain('min-width: var(--nue-box-size-md)')
            expect(rule).not.toContain('min-height: var(--nue-box-size-md)')
        }
    })

    it('AC1：齿轮落在 `nue-footer` 内（与导航同排），同步宿主落在工具带内（运行时结构）', async () => {
        mountAdapter(ref(0))
        await settle()

        const gear = document.getElementById('AppAsideDrawerSettingsGearBtn')
        expect(gear).toBeTruthy()
        expect(gear!.closest('.nue-footer')).toBeTruthy()
        expect(gear!.closest('.nue-div--aside__tools')).toBeNull()

        // 同步宿主仍在工具带内（吸底条），且不再与齿轮同容器
        const host = document.getElementById('AppAsideDrawerBottomSlot')
        expect(host).toBeTruthy()
        expect(host!.closest('.nue-div--aside__tools')).toBeTruthy()
        expect(host!.closest('.nue-footer')).toBeNull()
    })
})