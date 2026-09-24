// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, type Ref } from 'vue'
import { NueButton, NueDropdown, NueText, NueTooltip } from 'nue-ui'
import { CONFLICT_JOURNAL_LIMIT } from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'
import SyncStatusBar from '../sync-status-bar.vue'
import { bindRailBottomHost, unbindRailBottomHost } from '@/components/app/aside-v2/rail-host'
import { resetReadOnlyForTest } from '@nao-todo/presentation/offline'

/**
 * T162 用例先行（红基线）—— 阶段二 2B · 面 ③ 冲突 UX（可见面）
 *
 * 契约（ADR §9.2.1 / §9.2.4 / §9.6 R-15 / R-16；PRD AC4）：
 * - 状态面板「冲突 N」**入口可点击** ⇒ 打开冲突列表（弹层）；
 * - 列表/只读对比（败方快照 vs 当前行）+ 两种恢复动作（「保留服务端」/「以我的版本重试」）⇒ **属 T165**；
 * - **上限 200 + 折叠提示**（DP-2B-5）。
 *
 * 本文件只覆盖**结构无关**的两点（可见面）：
 * ① 冲突入口是**可交互控件**（button / role=button / tabindex）；
 * ② 达到上限时出现**折叠提示**文案（含「折叠」）。
 *
 * ⚠️ 列表/对比/两种恢复动作需 T165 的组件与数据面 API（当前无已存在导出可承载）⇒
 *    不臆造 API、不写相冲用例；回报 PM（见回执风险项）。
 * ⚠️ `@/hooks` 为整模块 mock（沿用既有组件测范式）：T165 若新增 hook，须同步扩展本文件 mock。
 *
 * **红窗口**：①②预期**红**（T165/W3 落地后转绿）。
 */

type MockSyncStatus = {
    syncing: boolean
    lastSyncAt: string | null
    mirrorPulledAt: string | null
    mirrorTruncated: boolean
    pendingCount: number
    failedCount: number
    preferenceFailedCount: number
    conflictCount: number
    paused: boolean
    lastError: string | null
}

const defaultStatus = (): MockSyncStatus => ({
    syncing: false,
    lastSyncAt: null,
    mirrorPulledAt: null,
    mirrorTruncated: false,
    pendingCount: 0,
    failedCount: 0,
    preferenceFailedCount: 0,
    conflictCount: 0,
    paused: false,
    lastError: null
})

const hooksMock = vi.hoisted(() => ({
    status: undefined as unknown,
    manualSyncing: undefined as unknown,
    run: undefined as unknown,
    loadedCount: undefined as unknown
}))

vi.mock('@/hooks', async () => {
    const { ref } = await import('vue')
    // ⚠️ 工厂被提升到文件顶部 ⇒ 不得引用顶层 `defaultStatus`（TDZ）；此处内联默认态
    const status = ref<MockSyncStatus>({
        syncing: false,
        lastSyncAt: null,
        mirrorPulledAt: null,
        mirrorTruncated: false,
        pendingCount: 0,
        failedCount: 0,
        preferenceFailedCount: 0,
        conflictCount: 0,
        paused: false,
        lastError: null
    })
    const manualSyncing = ref(false)
    const run = vi.fn()
    const loadedCount = ref(0)
    hooksMock.status = status
    hooksMock.manualSyncing = manualSyncing
    hooksMock.run = run
    hooksMock.loadedCount = loadedCount
    return {
        useSyncStatus: () => ({ status }),
        useManualSync: () => ({ syncing: manualSyncing, run }),
        useMirrorLoadedCount: () => loadedCount
    }
})

const status = (): Ref<MockSyncStatus> => hooksMock.status as Ref<MockSyncStatus>

vi.stubGlobal(
    'ResizeObserver',
    class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }
)

let wrapper: VueWrapper | null = null

const createHost = (): HTMLElement => {
    const host = document.createElement('div')
    host.id = 'AppAsideRailBottomSlot'
    document.body.appendChild(host)
    bindRailBottomHost(host)
    return host
}

const settle = async (): Promise<void> => {
    await nextTick()
    await nextTick()
}

const railButton = (): HTMLButtonElement | null =>
    document.querySelector<HTMLButtonElement>('.sync-rail-btn')

const openPanel = (): void => {
    railButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

const panel = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('.nue-dropdown--sync-panel')

const panelText = (): string => panel()?.textContent ?? ''

/** 冲突入口的可交互控件（button / role=button / tabindex） */
const conflictEntry = (): Element | undefined =>
    Array.from(panel()?.querySelectorAll('button, [role="button"], [tabindex]') ?? []).find((el) =>
        el.textContent?.includes('冲突')
    )

const mountBar = (): void => {
    createHost()
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
}

beforeEach(() => {
    status().value = defaultStatus()
    resetReadOnlyForTest()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    unbindRailBottomHost()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    resetReadOnlyForTest()
})

describe('面 ③ 冲突 UX 可见面（红基线）', () => {
    it('① 「冲突 N」入口为可交互控件（可点击打开冲突列表，ADR §9.2.1）', async () => {
        mountBar()
        await settle()
        openPanel()
        await settle()

        status().value = { ...status().value, conflictCount: 2 }
        await nextTick()

        expect(panelText()).toContain('冲突 2')
        expect(conflictEntry()).toBeTruthy()
    })

    it('② 达到上限 ⇒ 折叠提示可见（DP-2B-5 / ADR §9.2.4）', async () => {
        mountBar()
        await settle()
        openPanel()
        await settle()

        status().value = { ...status().value, conflictCount: CONFLICT_JOURNAL_LIMIT }
        await nextTick()

        expect(panelText()).toContain(`冲突 ${CONFLICT_JOURNAL_LIMIT}`)
        expect(panelText()).toContain('折叠')
    })
})