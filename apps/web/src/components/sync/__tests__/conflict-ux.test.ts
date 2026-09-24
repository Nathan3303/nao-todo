// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, type Ref } from 'vue'
import { NueButton, NueDropdown, NueText, NueTooltip } from 'nue-ui'
import {
    CONFLICT_JOURNAL_LIMIT,
    type ConflictComparison,
    type ConflictListItem
} from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'
import { messages, type LocaleKey } from '@nao-todo/shared/locales'
import SyncStatusBar from '../sync-status-bar.vue'
import { bindRailBottomHost, unbindRailBottomHost } from '@/components/app/aside-v2/rail-host'
import { resetReadOnlyForTest } from '@nao-todo/presentation/offline'

/** 冲突组件源码（`?raw`）：用于 i18n 悬空键 / 死键静态守护（T169） */
const conflictComponentSources = import.meta.glob('../*.vue', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>

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

type MockConflictUx = {
    items: Ref<ConflictListItem[]>
    folded: Ref<boolean>
    foldedReason: Ref<'limit' | 'evicted' | null>
    loading: Ref<boolean>
    error: Ref<string | null>
    comparison: Ref<ConflictComparison | null>
    retryFailed: Ref<boolean>
    refresh: ReturnType<typeof vi.fn>
    compare: ReturnType<typeof vi.fn>
    keepServer: ReturnType<typeof vi.fn>
    retryLocal: ReturnType<typeof vi.fn>
    closeComparison: ReturnType<typeof vi.fn>
}

const hooksMock = vi.hoisted(() => ({
    status: undefined as unknown,
    manualSyncing: undefined as unknown,
    run: undefined as unknown,
    loadedCount: undefined as unknown,
    conflict: undefined as unknown
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
    // T165/W3：ConflictList 经 `@/hooks` 取 `useConflictUx`（整模块 mock ⇒ 必须补本项，否则挂载即报错）
    const conflict = {
        items: ref([]),
        folded: ref(false),
        foldedReason: ref(null),
        loading: ref(false),
        error: ref(null),
        comparison: ref(null),
        retryFailed: ref(false),
        refresh: vi.fn(async () => {}),
        compare: vi.fn(async () => {}),
        keepServer: vi.fn(async () => {}),
        retryLocal: vi.fn(async () => {}),
        closeComparison: vi.fn(() => {})
    }
    hooksMock.status = status
    hooksMock.manualSyncing = manualSyncing
    hooksMock.run = run
    hooksMock.loadedCount = loadedCount
    hooksMock.conflict = conflict
    return {
        useSyncStatus: () => ({ status }),
        useManualSync: () => ({ syncing: manualSyncing, run }),
        useMirrorLoadedCount: () => loadedCount,
        useConflictUx: () => conflict
    }
})

const status = (): Ref<MockSyncStatus> => hooksMock.status as Ref<MockSyncStatus>

const conflict = (): MockConflictUx => hooksMock.conflict as MockConflictUx

/** 冲突条目的空态复位（`vi.restoreAllMocks()` 只清调用记录，不清 ref 值） */
const resetConflict = (): void => {
    const c = conflict()
    c.items.value = []
    c.folded.value = false
    c.foldedReason.value = null
    c.loading.value = false
    c.error.value = null
    c.comparison.value = null
    c.retryFailed.value = false
}

const conflictItem = (over: Partial<ConflictListItem> = {}): ConflictListItem => ({
    id: 'tasks:t1:2026-09-24T00:00:00.000Z',
    kind: 'stale',
    table: 'tasks',
    entityId: 't1',
    loser: { name: '本地标题' },
    winnerUpdatedAt: '2026-09-24T00:00:00.000Z',
    loserUpdatedAt: '2026-09-23T00:00:00.000Z',
    at: '2026-09-24T00:00:00.000Z',
    ...over
})

/** 冲突组件源码中引用的 `sync.conflict*` 键（去重） */
const referencedConflictKeys = (): string[] => {
    const source = Object.values(conflictComponentSources).join('\n')
    return [...new Set(source.match(/sync\.conflict[\w.-]*/g) ?? [])]
}

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
    resetConflict()
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

/** 打开同步面板并展开冲突列表（入口 → 列表），返回是否成功挂载 ConflictList */
const openConflictList = async (count = 1): Promise<void> => {
    mountBar()
    await settle()
    openPanel()
    await settle()
    status().value = { ...status().value, conflictCount: count }
    await nextTick()
    const entry = conflictEntry() as HTMLElement | undefined
    entry?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await settle()
}

const actionButton = (text: string): HTMLButtonElement | undefined =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('.conflict-list__actions button')).find(
        (button) => button.textContent?.includes(text)
    )

describe('面 ③ 冲突 UX 交互（T165/W3 · ADR §9.2.1 / §9.2.2）', () => {
    it('入口 → 列表 → 只读对比 → 两种恢复动作（全链路可交互）', async () => {
        await openConflictList(1)

        // 入口：可交互控件；点击前无列表，点击后 ConflictList 挂载且触发 refresh
        expect(document.querySelector('.conflict-list')).toBeTruthy()
        expect(conflict().refresh).toHaveBeenCalled()

        // 列表：条目渲染表名（本地化）+ 败方标题
        const item = conflictItem()
        conflict().items.value = [item]
        await nextTick()
        const itemButton = document.querySelector<HTMLButtonElement>('.conflict-list__entry')
        expect(itemButton?.textContent).toContain('任务')
        expect(itemButton?.textContent).toContain('本地标题')

        // 只读对比：点击条目 ⇒ compare(item)；渲染字段级差异（败方 vs 当前）
        itemButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await settle()
        expect(conflict().compare).toHaveBeenCalledWith(item)
        conflict().comparison.value = {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '本地标题' },
            current: { name: '服务端标题' },
            diffs: [{ field: 'name', loser: '本地标题', current: '服务端标题' }]
        }
        await nextTick()
        expect(panelText()).toContain(messages['zh-CN']['sync.conflict.compareTitle'])
        expect(panelText()).toContain('本地标题')
        expect(panelText()).toContain('服务端标题')

        // 两种恢复动作：A 保留服务端 / B 以我的版本重试
        actionButton(messages['zh-CN']['sync.conflict.keepServer'])?.dispatchEvent(
            new MouseEvent('click', { bubbles: true })
        )
        await settle()
        expect(conflict().keepServer).toHaveBeenCalledWith(item)

        actionButton(messages['zh-CN']['sync.conflict.retryLocal'])?.dispatchEvent(
            new MouseEvent('click', { bubbles: true })
        )
        await settle()
        expect(conflict().retryLocal).toHaveBeenCalledWith(item)
    })

    it('动作 B 显式失败 ⇒ 可见提示（不静默 · AC4）', async () => {
        await openConflictList(1)
        const item = conflictItem()
        conflict().items.value = [item]
        conflict().comparison.value = {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '本地标题' },
            current: null,
            diffs: [{ field: 'name', loser: '本地标题', current: null }]
        }
        await nextTick()
        expect(panelText()).not.toContain(messages['zh-CN']['sync.conflict.retryFailed'])

        conflict().retryFailed.value = true
        await nextTick()
        expect(panelText()).toContain(messages['zh-CN']['sync.conflict.retryFailed'])
    })

    it('折叠提示两文案区分：limit（已达上限）vs evicted（更早已折叠/丢弃）—— DP-2B-5 / R-15', async () => {
        await openConflictList(1)
        const foldLimit = messages['zh-CN']['sync.conflict.foldLimit']
        const foldEvicted = messages['zh-CN']['sync.conflict.foldEvicted']
        expect(foldLimit).not.toBe(foldEvicted)
        // `evicted` 文案必须表达「更早的冲突记录已折叠 / 丢弃」（R-15 信号强度）
        expect(foldEvicted).toMatch(/折叠|丢弃/)

        conflict().folded.value = true
        conflict().foldedReason.value = 'limit'
        await nextTick()
        expect(panelText()).toContain(foldLimit)
        expect(panelText()).not.toContain(foldEvicted)

        conflict().foldedReason.value = 'evicted'
        await nextTick()
        expect(panelText()).toContain(foldEvicted)
        expect(panelText()).not.toContain(foldLimit)
    })
})

describe('面 ③ i18n 中英键齐备 / 死键守护（T169）', () => {
    it('中英键集合逐字相同（运行期再核 `LocaleMessages` 编译期约束）', () => {
        expect(Object.keys(messages['en-US']).sort()).toEqual(Object.keys(messages['zh-CN']).sort())
    })

    it('冲突命名空间键两端齐备且非空、未回落为键名', () => {
        const conflictKeys = Object.keys(messages['zh-CN']).filter((key) =>
            key.startsWith('sync.conflict')
        )
        expect(conflictKeys.length).toBeGreaterThanOrEqual(20)
        for (const key of conflictKeys) {
            const zh = messages['zh-CN'][key as LocaleKey]
            const en = messages['en-US'][key as LocaleKey]
            expect(zh, key).toBeTruthy()
            expect(en, key).toBeTruthy()
            expect(zh, key).not.toBe(key)
            expect(en, key).not.toBe(key)
        }
    })

    it('冲突组件引用的键均已定义（无悬空键 / 不回落为键名）', () => {
        const referenced = referencedConflictKeys()
        expect(referenced.length).toBeGreaterThan(0)
        const defined = new Set(Object.keys(messages['zh-CN']))
        expect(referenced.filter((key) => !defined.has(key))).toEqual([])
    })

    it('无新增死键：冲突命名空间中零消费者的键 = 已登记白名单', () => {
        const referenced = new Set(referencedConflictKeys())
        const unused = Object.keys(messages['zh-CN'])
            .filter((key) => key.startsWith('sync.conflict') && !referenced.has(key))
            .sort()
        // 已知死键（T169 登记，非阻塞；先例 `offline.readOnlyBanner`）：`sync.conflict.title` 零生产消费者
        expect(unused).toEqual(['sync.conflict.title'])
    })
})