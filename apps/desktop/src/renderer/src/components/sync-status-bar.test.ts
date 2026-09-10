// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, type Ref } from 'vue'
import { NueButton, NueDropdown, NueText, NueTooltip } from 'nue-ui'
import SyncStatusBar from './sync-status-bar.vue'
import { bindRailBottomHost, unbindRailBottomHost } from '@/components/app/aside-v2/rail-host'
import { setLocale } from '@nao-todo/shared'

/**
 * SHELL-02 桌面端同步状态（轨道底部）组件断言
 * @description 4 例（用户裁剪后定稿）：① 宿主存在注入点渲染 ② 宿主缺失负向闭环 ③ click 开 + Esc 关 +
 *              焦点归还 ④ 三态文案。关闭态口径见 ADR C9/C10（只断言 data-visible=false 或我方门控
 *              内容不存在，不断言池为空/面板 DOM 移除）；不触碰库内 tpState/mountPopupAnchor（C8′）。
 * @see docs/adr/2026-09-10-shell-02-sync-status-rail-teleport.md
 */

type MockSyncStatus = {
    syncing: boolean
    lastSyncAt: string | null
    pendingCount: number
    failedCount: number
    lastError: string | null
}

// desktop 的 @/hooks 指向 apps/desktop 的 hooks（electron.vite.config.ts 别名顺序），
// 与 root vitest 的 @ 别名（apps/web/src）不一致 → 不改 root alias，用 vi.mock 工厂隔离装配层。
const hooksMock = vi.hoisted(() => ({
    status: undefined as unknown,
    manualSyncing: undefined as unknown,
    run: undefined as unknown
}))

vi.mock('@/hooks', async () => {
    const { ref } = await import('vue')
    const status = ref<MockSyncStatus>({
        syncing: false,
        lastSyncAt: null,
        pendingCount: 0,
        failedCount: 0,
        lastError: null
    })
    const manualSyncing = ref(false)
    const run = vi.fn()
    hooksMock.status = status
    hooksMock.manualSyncing = manualSyncing
    hooksMock.run = run
    return {
        useSyncStatus: () => ({ status }),
        useManualSync: () => ({ syncing: manualSyncing, run })
    }
})

const status = (): Ref<MockSyncStatus> => hooksMock.status as Ref<MockSyncStatus>

// jsdom 未实现 ResizeObserver；D5=B（`:transparent="true"`）下库在 mounted 内 new ResizeObserver
// （nue-ui 1.10.58 / 1.11.0 同构）→ 测试环境补最小桩（非透明模式不创建，产品代码不依赖）
vi.stubGlobal(
    'ResizeObserver',
    class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }
)

let wrapper: VueWrapper | null = null

/** 挂载组件（轨道按钮/面板经 Teleport 进入注入点，故断言一律查 document） */
const mountBar = (): VueWrapper => {
    wrapper = mount(SyncStatusBar, {
        attachTo: document.body,
        global: {
            components: {
                'nue-button': NueButton,
                'nue-dropdown': NueDropdown,
                'nue-text': NueText,
                'nue-tooltip': NueTooltip
            }
        }
    })
    return wrapper
}

/** 建注入点宿主并挂到文档（消费侧用元素目标 + v-if，不走字符串选择器） */
const createHost = (): HTMLElement => {
    const host = document.createElement('div')
    host.id = 'AppAsideRailBottomSlot'
    document.body.appendChild(host)
    bindRailBottomHost(host)
    return host
}

/** 等待库 open/@open 门控两级提交（库在 nextTick 内 emit('open')） */
const settle = async (): Promise<void> => {
    await nextTick()
    await nextTick()
}

const railButton = (): HTMLButtonElement | null =>
    document.querySelector<HTMLButtonElement>('.sync-rail-btn')

const openPanel = (): void => {
    railButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

const panelText = (): string => document.querySelector('.nue-dropdown')?.textContent ?? ''

/** 读屏活动区域文本（NFR：只播摘要，不播 lastError 全文） */
const liveSummary = (): string =>
    document.querySelector('.sync-live-region')?.textContent?.trim() ?? ''

beforeEach(() => {
    status().value = {
        syncing: false,
        lastSyncAt: null,
        pendingCount: 0,
        failedCount: 0,
        lastError: null
    }
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    unbindRailBottomHost()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('SyncStatusBar - SHELL-02 轨道同步状态', () => {
    it('宿主存在：渲染进注入点，轨道按钮存在', async () => {
        mountBar()
        await settle()
        // 挂载时机未到（注册表尚未置位）：不渲染、无残留
        expect(document.querySelector('.sync-rail-btn')).toBeNull()

        const host = createHost()
        await settle()

        const button = host.querySelector<HTMLButtonElement>('.sync-rail-btn')
        expect(button).toBeTruthy()
        // 全文档唯一（未在组件原挂载处重复渲染）
        expect(document.querySelectorAll('.sync-rail-btn').length).toBe(1)
        // C13：aria-label 走 i18n、aria-expanded 走 trigger slot 的 visible（关闭态 false）
        expect(button?.getAttribute('aria-label')).toBe('同步')
        expect(button?.getAttribute('aria-expanded')).toBe('false')
        // C12：关闭态不得出现库内 <span>无选项</span> 回落（default slot 保留常驻结构 <li>）
        expect(document.querySelector('.nue-dropdown__empty-text')).toBeNull()
    })

    it('宿主缺失：不渲染且无 warn/error（负向闭环，C3/C5）', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})

        unbindRailBottomHost()
        mountBar()
        await settle()

        expect(document.querySelector('.sync-rail-btn')).toBeNull()
        expect(document.querySelector('.nue-dropdown')).toBeNull()
        expect(warn).not.toHaveBeenCalled()
        expect(error).not.toHaveBeenCalled()
    })

    it('click 开面板 + Esc 关 + 焦点归还轨道按钮', async () => {
        createHost()
        mountBar()
        await settle()

        const button = railButton()
        expect(button).toBeTruthy()

        openPanel()
        await settle()

        // 打开态：面板生效（data-visible）且我方门控内容已渲染；footer 动作按钮结构在位（AC-03 Tab 目标）
        expect(document.querySelector('.nue-dropdown')?.getAttribute('data-visible')).toBe('true')
        expect(document.querySelector('.sync-panel__row')).toBeTruthy()
        expect(document.querySelector('.sync-panel__footer button')).toBeTruthy()
        expect(button?.getAttribute('aria-expanded')).toBe('true')

        // Esc 关闭（NueOverlay 承接 keydown → 库 emit('close')）
        const overlay = document.querySelector<HTMLElement>('.nue-dropdown-overlay')
        expect(overlay).toBeTruthy()
        overlay?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        await settle()

        // 关闭态口径（C9/C10）：只断言 data-visible 与我方门控内容，不断言池为空/面板彻底移除
        expect(document.querySelector('.nue-dropdown')?.getAttribute('data-visible')).toBe('false')
        expect(document.querySelector('.sync-panel__row')).toBeNull()
        // C16：@close + nextTick 归还焦点
        expect(document.activeElement).toBe(button)
    })

    it('三态文案：从未同步 / 同步中 / 失败+计数', async () => {
        createHost()
        mountBar()
        await settle()
        openPanel()
        await settle()

        // ① 从未同步（AC-06 zh）
        expect(panelText()).toContain('从未同步')
        expect(liveSummary()).toBe('') // 无同步中、无失败 → 摘要为空

        // ② 同步中：首行文案 + 轨道按钮 loading ⇒ disabled（AC-04 预期行为）
        status().value = { ...status().value, syncing: true }
        await nextTick()
        expect(panelText()).toContain('同步中')
        expect(railButton()?.disabled).toBe(true)
        expect(liveSummary()).toBe('同步中…')

        // ③ 失败 + 计数 + 错误摘要（title 全文、文本插值、无 v-html）
        status().value = {
            syncing: false,
            lastSyncAt: '2026-09-10T10:00:00.000Z',
            pendingCount: 2,
            failedCount: 1,
            lastError: 'Sync failed: boom'
        }
        await nextTick()
        expect(railButton()?.disabled).toBe(false)
        expect(panelText()).toContain('待推送 2')
        expect(panelText()).toContain('失败 1')
        expect(panelText()).toContain('上次同步')
        const error = document.querySelector('.sync-panel__error')
        expect(error?.getAttribute('title')).toBe('Sync failed: boom')
        expect(error?.textContent).toContain('Sync failed: boom')
        expect(error?.querySelector('*')).toBeNull()
        // 活动区域只播摘要：只有「失败 N」，不含 lastError 全文
        expect(liveSummary()).toBe('失败 1')
        expect(liveSummary()).not.toContain('Sync failed: boom')

        // ④ AC-06 en：文案随 locale 本地化（t 在渲染期读取 locale，组件重渲染）
        setLocale('en-US')
        status().value = { ...status().value, syncing: false, lastSyncAt: null }
        await nextTick()
        expect(panelText()).toContain('Never synced')
        setLocale('zh-CN')
    })
})