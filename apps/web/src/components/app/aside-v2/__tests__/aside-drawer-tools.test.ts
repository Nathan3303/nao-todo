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

/** 布局原语 stub（attrs/插槽透传 ⇒ 断言只看本组件产出的结构与顺序） */
const layoutStub = { template: '<div><slot /></div>' }

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
                'nue-content': layoutStub,
                'nue-footer': layoutStub,
                'nue-div': layoutStub,
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