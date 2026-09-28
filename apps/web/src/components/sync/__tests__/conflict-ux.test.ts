// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, type Ref } from 'vue'
import {
    NueButton,
    NueDialog,
    NueDiv,
    NueDropdown,
    NueEmpty,
    NueIcon,
    NueText,
    NueTooltip
} from 'nue-ui'
import {
    CONFLICT_JOURNAL_LIMIT,
    type ConflictComparison,
    type ConflictListItem
} from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'
import { messages, type LocaleKey } from '@nao-todo/shared/locales'
import SyncStatusBar from '../sync-status-bar.vue'
import { bindRailBottomHost, unbindRailBottomHost } from '@/components/app/aside-v2/rail-host'
import { resetReadOnlyForTest } from '@nao-todo/presentation/offline'

/** 冲突组件源码（`?raw`）：用于 i18n 悬空键 / 死键静态守护（T169）——
 *  T338：同时扇入同目录 `.ts`（`DIFF_LABEL_KEY` 等纯函数模块也消费 i18n 键） */
const conflictComponentSources = import.meta.glob('../*.{vue,ts}', {
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
        retryLocal: vi.fn(async () => {})
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

/** `conflict-list.vue` 原始源码（静态样式守护：分割线 / 堆叠态分支） */
const conflictListSource = (): string =>
    Object.entries(conflictComponentSources).find(([path]) =>
        path.includes('conflict-list.vue')
    )?.[1] ?? ''

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

/** T338：对话框内容（NueDialog 传送至 body）⇒ 读 body 文本（面板 + 对话框并集） */
const dialogText = (): string => document.body.textContent ?? ''

/** 冲突入口按钮（按稳定类名定位；文案已改为「N 项待确认」，不用文本匹配） */
const conflictEntry = (): Element | undefined =>
    panel()?.querySelector('.sync-conflict-entry') ?? undefined

const mountBar = (): void => {
    createHost()
    wrapper = mount(SyncStatusBar, {
        attachTo: document.body,
        global: {
            components: {
                'nue-button': NueButton,
                'nue-dialog': NueDialog,
                'nue-div': NueDiv,
                'nue-dropdown': NueDropdown,
                'nue-empty': NueEmpty,
                'nue-icon': NueIcon,
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

        expect(panelText()).toContain('2 项待确认')
        expect(conflictEntry()).toBeTruthy()
    })

    it('② 达到上限 ⇒ 折叠提示可见（DP-2B-5 / ADR §9.2.4）', async () => {
        mountBar()
        await settle()
        openPanel()
        await settle()

        status().value = { ...status().value, conflictCount: CONFLICT_JOURNAL_LIMIT }
        await nextTick()

        expect(panelText()).toContain(`${CONFLICT_JOURNAL_LIMIT} 项待确认`)
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

        // 左栏：仅对象名称行（无类型/时间）；点击行 ⇒ 展示详情
        const item = conflictItem()
        conflict().items.value = [item]
        await nextTick()
        const itemButton = document.querySelector<HTMLButtonElement>('.conflict-list__entry')
        expect(itemButton?.textContent).toContain('本地标题')
        expect(itemButton?.textContent).not.toContain('任务')
        expect(itemButton?.textContent).not.toContain(messages['zh-CN']['sync.conflict.kind.stale'])
        expect(document.querySelector('.conflict-list__entry-time')).toBeFalsy()

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
        expect(dialogText()).toContain(messages['zh-CN']['sync.conflict.compareTitle'])
        expect(dialogText()).toContain('本地标题')
        expect(dialogText()).toContain('服务端标题')

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
        expect(dialogText()).not.toContain(messages['zh-CN']['sync.conflict.retryFailed'])

        conflict().retryFailed.value = true
        await nextTick()
        expect(dialogText()).toContain(messages['zh-CN']['sync.conflict.retryFailed'])
    })

    it('T332：分组标题在无标题时优雅降级（entityId ⇒ 本地化 kind），不出现空白/undefined', async () => {
        await openConflictList(2)
        conflict().items.value = [
            conflictItem({ id: 'a', loser: null, entityId: 't-9' }),
            conflictItem({ id: 'b', loser: null, entityId: '', kind: 'conflict' })
        ]
        await nextTick()
        const heads = Array.from(
            document.querySelectorAll<HTMLElement>('.conflict-list__entry')
        ).map((el) => el.textContent ?? '')
        expect(heads).toHaveLength(2)
        expect(heads[0]).toContain('t-9')
        expect(heads[1]).toContain(messages['zh-CN']['sync.conflict.kind.conflict'])
        for (const head of heads) {
            expect(head).not.toContain('undefined')
            expect(head.replace(/\s/g, '')).not.toBe('')
        }
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
        expect(dialogText()).toContain(foldLimit)
        expect(dialogText()).not.toContain(foldEvicted)

        conflict().foldedReason.value = 'evicted'
        await nextTick()
        expect(dialogText()).toContain(foldEvicted)
        expect(dialogText()).not.toContain(foldLimit)
    })
})

describe('T338 冲突对话框（模态 + 两栏 + a11y + T331 回归）', () => {
    it('入口「冲突 N」⇒ 打开 role=dialog / aria-modal 的对话框（左栏记录 + 右栏提示）', async () => {
        await openConflictList(2)

        const dialog = document.querySelector('[role="dialog"][aria-modal="true"]')
        expect(dialog).toBeTruthy()
        expect(document.querySelector('.conflict-list__left')).toBeTruthy()
        expect(document.querySelector('.conflict-list__right')).toBeTruthy()
        // header 显示条数（对话框传送至 body ⇒ 读 body 文本）
        expect(document.body.textContent).toContain(messages['zh-CN']['sync.conflict.title'])
        // 未选中 ⇒ 右栏提示
        expect(document.body.textContent).toContain(messages['zh-CN']['sync.conflict.selectHint'])
    })

    it('× 关闭 ⇒ 对话框卸载且焦点归还触发按钮', async () => {
        await openConflictList(1)
        expect(document.querySelector('[role="dialog"]')).toBeTruthy()

        const closeBtn = document.querySelector<HTMLButtonElement>('.nue-dialog__header__closebtn')
        expect(closeBtn).toBeTruthy()
        closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
        // jsdom 不跑 CSS 动画 ⇒ 手动补 animationend 触发 NueDialog 的 model 写回
        document
            .querySelector('.nue-dialog')
            ?.dispatchEvent(new Event('animationend', { bubbles: true }))
        await settle()

        expect(document.querySelector('[role="dialog"]')).toBeFalsy()
        expect(document.activeElement).toBe(document.querySelector('.sync-conflict-entry'))
    })

    it('T331 回归：对话框内处理冲突 ⇒ 入口计数递减（数据面同源写回，详见 infra 测试）', async () => {
        await openConflictList(2)
        const item = conflictItem()
        conflict().items.value = [item]
        conflict().comparison.value = {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '本地标题' },
            current: { name: '服务端标题' },
            diffs: [{ field: 'name', loser: '本地标题', current: '服务端标题' }]
        }
        // 模拟数据面副作用（真实副作用由 t331-conflict-count-refresh.test.ts 保证）
        conflict().keepServer.mockImplementationOnce(async () => {
            status().value = { ...status().value, conflictCount: 1 }
        })
        await nextTick()
        actionButton(messages['zh-CN']['sync.conflict.keepServer'])?.dispatchEvent(
            new MouseEvent('click', { bubbles: true })
        )
        await settle()

        expect(conflict().keepServer).toHaveBeenCalledWith(item)
        expect(panelText()).toContain('1 项待确认')
    })
})

describe('T339 第二轮反馈（分割线 / 左栏精简 / 技术字段常显）', () => {
    it('两栏分隔：左栏竖向 1px 分隔（既有 border 色）；<900px 堆叠时改横向（静态样式守护）', () => {
        const src = conflictListSource()
        expect(src).toContain('border-right: 1px solid var(--nue-border-color)')
        // 堆叠态分支：竖分隔关闭 ⇒ 改横向（复用左栏下边框）
        const stacked = src.slice(src.indexOf('@media (max-width: 899.98px)'))
        expect(stacked).toContain('border-right: none')
        expect(stacked).toContain('border-bottom: 1px solid var(--nue-border-color)')
    })

    it('左栏只保留「对象名称」（无冲突类型/时间）', async () => {
        await openConflictList(1)
        conflict().items.value = [conflictItem()]
        await nextTick()
        const entry = document.querySelector<HTMLElement>('.conflict-list__entry')
        expect(entry?.textContent).toContain('本地标题')
        expect(entry?.textContent).not.toContain(messages['zh-CN']['sync.conflict.kind.stale'])
        expect(document.querySelector('.conflict-list__entry-time')).toBeFalsy()
    })

    it('被移出的信息在右栏「对象信息」可见（类型 / 实体 ID / 冲突 ID / 发生时间）', async () => {
        await openConflictList(1)
        const item = conflictItem()
        conflict().items.value = [item]
        conflict().comparison.value = {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '本地标题' },
            current: { name: '服务端标题' },
            diffs: [{ field: 'name', loser: '本地标题', current: '服务端标题' }]
        }
        await nextTick()
        const text = dialogText()
        expect(text).toContain(messages['zh-CN']['sync.conflict.objectInfo'])
        expect(text).toContain(messages['zh-CN']['sync.conflict.metaTable'])
        expect(text).toContain(messages['zh-CN']['sync.conflict.table.tasks'])
        expect(text).toContain(messages['zh-CN']['sync.conflict.metaKind'])
        expect(text).toContain(messages['zh-CN']['sync.conflict.kind.stale'])
        expect(text).toContain(messages['zh-CN']['sync.conflict.metaEntityId'])
        expect(text).toContain('t1')
        expect(text).toContain(messages['zh-CN']['sync.conflict.metaEntryId'])
        expect(text).toContain(item.id)
        expect(text).toContain(messages['zh-CN']['sync.conflict.metaAt'])
    })

    it('技术字段始终显示（无开关）且排在普通字段之后（轻分隔 + 次要样式）', async () => {
        await openConflictList(1)
        conflict().items.value = [conflictItem()]
        conflict().comparison.value = {
            table: 'tasks',
            entityId: 't1',
            loser: {},
            current: {},
            diffs: [
                { field: 'name', loser: '旧', current: '新' },
                { field: 'updatedAt', loser: 'A', current: 'B' }
            ]
        }
        await nextTick()
        // 开关已移除
        expect(document.querySelector('.conflict-list__tech-toggle')).toBeFalsy()
        const allRows = Array.from(document.querySelectorAll('.conflict-list__diff'))
            .map((el) => el.textContent ?? '')
            .join('|')
        // 字段名为可读标签（非 raw 技术名）
        expect(allRows).toContain(messages['zh-CN']['sync.conflict.field.name'])
        expect(allRows).toContain(messages['zh-CN']['sync.conflict.field.updatedAt'])
        expect(allRows).not.toContain('updatedAt')
        // 技术字段段落排在普通字段之后
        const text = dialogText()
        expect(text).toContain(messages['zh-CN']['sync.conflict.technicalSection'])
        expect(text.indexOf(messages['zh-CN']['sync.conflict.field.updatedAt'])).toBeGreaterThan(
            text.indexOf(messages['zh-CN']['sync.conflict.technicalSection'])
        )
    })
})

describe('T342 三态（LoadingError） + 左栏对象行', () => {
    it('loading ⇒ 左栏展示 LoadingError 加载态', async () => {
        await openConflictList(1)
        conflict().loading.value = true
        await nextTick()
        expect(dialogText()).toContain(messages['zh-CN']['sync.conflict.loading'])
    })

    it('error ⇒ 左栏展示错误文案 + 可点「重试」（点击调用 refresh）', async () => {
        await openConflictList(1)
        conflict().loading.value = false
        conflict().error.value = 'boom'
        await nextTick()
        expect(dialogText()).toContain(messages['zh-CN']['sync.conflict.loadFailed'])
        const retry = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
            (button) => button.textContent?.includes(messages['zh-CN']['common.retry'])
        )
        expect(retry).toBeTruthy()
        const before = conflict().refresh.mock.calls.length
        retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await settle()
        expect(conflict().refresh.mock.calls.length).toBeGreaterThan(before)
    })

    it('empty ⇒ 左栏展示 LoadingError 空态文案', async () => {
        await openConflictList(1)
        conflict().loading.value = false
        conflict().error.value = null
        conflict().items.value = []
        await nextTick()
        expect(dialogText()).toContain(messages['zh-CN']['sync.conflict.empty'])
    })

    it('无字段差异 ⇒ 差异详情区展示 LoadingError 空态', async () => {
        await openConflictList(1)
        conflict().items.value = [conflictItem()]
        conflict().comparison.value = {
            table: 'tasks',
            entityId: 't1',
            loser: {},
            current: {},
            diffs: []
        }
        await nextTick()
        expect(dialogText()).toContain(messages['zh-CN']['sync.conflict.noFieldDiff'])
        expect(document.querySelectorAll('.conflict-list__diff')).toHaveLength(0)
    })

    it('T346：1 个对象 3 条记录 ⇒ 标题与行数均按对象数（1），右栏展示 3 条记录 + 全部类型', async () => {
        await openConflictList(1)
        conflict().items.value = [
            conflictItem({ id: 'a', kind: 'stale' }),
            conflictItem({ id: 'b', kind: 'push-noop' }),
            conflictItem({ id: 'c', kind: 'remote-wins' })
        ]
        conflict().comparison.value = {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '本地标题' },
            current: { name: '服务端标题' },
            diffs: [{ field: 'name', loser: '本地标题', current: '服务端标题' }]
        }
        await nextTick()

        // 标题按**对象数**（1），不是记录数（3）
        expect(dialogText()).toContain('1 项待确认')
        expect(dialogText()).not.toContain('3 项待确认')
        // 左栏只有 1 行（一行一对象）
        expect(document.querySelectorAll('.conflict-list__entry')).toHaveLength(1)
        // 右栏对象信息：记录条数 = 3 + 全部类型（去重）
        const meta = document.querySelector('.conflict-list__meta-list')?.textContent ?? ''
        expect(meta).toContain(messages['zh-CN']['sync.conflict.metaRecordCount'])
        expect(meta).toContain('3')
        expect(meta).toContain(messages['zh-CN']['sync.conflict.kind.stale'])
        expect(meta).toContain(messages['zh-CN']['sync.conflict.kind.push-noop'])
        expect(meta).toContain(messages['zh-CN']['sync.conflict.kind.remote-wins'])
    })

    it('左栏对象行：点击 ⇒ 选中该对象（仅该行高亮）+ 展示详情', async () => {
        await openConflictList(2)
        const item = conflictItem()
        // 同一对象两条 journal 条目 ⇒ 仍是**一行**（避免「全 active」）
        conflict().items.value = [item, conflictItem({ id: 't1b' })]
        await nextTick()
        const rows = document.querySelectorAll<HTMLElement>('.conflict-list__entry')
        expect(rows).toHaveLength(1)
        expect(rows[0]?.getAttribute('aria-selected')).toBe('false')
        rows[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
        expect(conflict().compare).toHaveBeenCalled()
        conflict().comparison.value = {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '本地标题' },
            current: { name: '服务端标题' },
            diffs: [{ field: 'name', loser: '本地标题', current: '服务端标题' }]
        }
        await nextTick()
        expect(rows[0]?.getAttribute('aria-selected')).toBe('true')
    })
})

describe('T347 修复（对比度 / 深色 token / 焦点归还 / 空态图 / 关闭语义）', () => {
    /** 选中一个对象 ⇒ 右栏渲染（footer 动作区仅在 comparison 存在时渲染） */
    const selectObject = async (): Promise<void> => {
        conflict().items.value = [conflictItem()]
        conflict().comparison.value = {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '本地标题' },
            current: { name: '服务端标题' },
            diffs: [{ field: 'name', loser: '本地标题', current: '服务端标题' }]
        }
        await nextTick()
    }

    it('① 对比度按真实底色（卡片 -100）重算：绿色系小文本/符号提级至 -100', () => {
        const src = conflictListSource().replace(/\r/g, '')
        expect(src).toContain(
            '.conflict-list__state-label.is-added {\n    color: var(--nue-success-color-100);'
        )
        expect(src).toContain(
            '.conflict-list__symbol.is-added {\n    color: var(--nue-success-color-100);'
        )
        expect(src).toContain(
            '.conflict-list__symbol.is-changed {\n    color: var(--nue-warning-color-90);'
        )
        // 旧的「按白底估算」注释不得残留
        expect(src).not.toContain('实测 4.95 / 6.67 / 8.97')
    })

    it('② 深色技术卡片走主题 token（无写死亮色 #efefef）', () => {
        const src = conflictListSource().replace(/\r/g, '')
        expect(src).not.toContain('#efefef')
        expect(src).toContain(
            '.conflict-list__diff.is-technical {\n    background-color: var(--nue-primary-color-100);'
        )
    })

    it('④ 空态图统一 assetUrl（无 /public 404 路径 / 无未绑定占位符）', () => {
        const src = conflictListSource().replace(/\r/g, '')
        expect(src).not.toContain('/public/images')
        expect(src).not.toContain('assetUrlPlaceholder')
        expect(src).toContain("assetUrl('/images/notaskhere.webp')")
        expect(src).toContain("assetUrl('/images/todo.webp')")
    })

    it('⑤ 底部「关闭」= 关闭对话框（不再只清空右栏），且父面板保持打开', async () => {
        await openConflictList(1)
        await selectObject()
        const close = actionButton(messages['zh-CN']['sync.conflict.close'])
        expect(close).toBeTruthy()
        close?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await settle()
        expect(document.querySelector('[role="dialog"]')).toBeFalsy()
        // 回归：点击冒泡到 window 曾误关父面板 ⇒ 入口按钮不在可聚焦状态
        expect(panel()?.getAttribute('data-visible')).toBe('true')
        expect(document.activeElement).toBe(document.querySelector('.sync-conflict-entry'))
    })

    it('③ Esc 关闭 ⇒ 焦点同样归还入口按钮（与 × / 底部按钮一致）', async () => {
        await openConflictList(1)
        await selectObject()
        document
            .querySelector('.nue-dialog-overlay')
            ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        await nextTick()
        document
            .querySelector('.nue-dialog')
            ?.dispatchEvent(new Event('animationend', { bubbles: true }))
        await settle()
        expect(document.querySelector('[role="dialog"]')).toBeFalsy()
        expect(panel()?.getAttribute('data-visible')).toBe('true')
        expect(document.activeElement).toBe(document.querySelector('.sync-conflict-entry'))
    })

    it('③ 连续快速「开→×」3 次 ⇒ 面板始终打开、焦点稳定在入口按钮', async () => {
        await openConflictList(1)
        await selectObject()
        for (let i = 0; i < 3; i += 1) {
            conflictEntry()?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
            await settle()
            document
                .querySelector<HTMLButtonElement>('.nue-dialog__header__closebtn')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
            await settle()
            expect(document.querySelector('[role="dialog"]')).toBeFalsy()
            expect(panel()?.getAttribute('data-visible')).toBe('true')
            expect(document.activeElement).toBe(document.querySelector('.sync-conflict-entry'))
        }
    })

    it('T353：关闭对话框不摘除截断监听（覆盖「关闭那次 click」的冒泡）', async () => {
        await openConflictList(1)
        await selectObject()
        // 修复前：`watch(open)` 的 open→false 分支在关闭 click 冒泡途中同步 `removeEventListener`
        // ⇒ 该 click 继续冒泡命中 dropdown 的 window 监听 ⇒ 面板被关。监听器须「常驻」。
        const removeSpy = vi.spyOn(Element.prototype, 'removeEventListener')
        document
            .querySelector<HTMLButtonElement>('.nue-dialog__header__closebtn')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await settle()
        expect(removeSpy.mock.calls.filter(([type]) => type === 'click')).toEqual([])
        removeSpy.mockRestore()
    })

    it('T353：对话框内点击不得到达 window 层监听（dropdown「点外部即关」）', async () => {
        await openConflictList(1)
        await selectObject()
        const winSpy = vi.fn()
        window.addEventListener('click', winSpy)
        document
            .querySelector<HTMLButtonElement>('.nue-dialog__header__closebtn')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await settle()
        expect(winSpy).not.toHaveBeenCalled()
        window.removeEventListener('click', winSpy)
        // 面板保持打开 + 焦点归还
        expect(panel()?.getAttribute('data-visible')).toBe('true')
        expect(document.activeElement).toBe(document.querySelector('.sync-conflict-entry'))
    })

    it('不回归：面板外点击仍能关闭面板（document 级截断只作用于对话框内）', async () => {
        await openConflictList(1)
        await selectObject()
        const outside = document.createElement('div')
        document.body.appendChild(outside)
        outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await settle()
        expect(panel()?.getAttribute('data-visible')).toBe('false')
        outside.remove()
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
        // T338：`sync.conflict.title` 已用作对话框标题 ⇒ 冲突命名空间零死键
        expect(unused).toEqual([])
    })
})