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
    titles: Ref<Record<string, { name: string | null; parentTaskName: string | null }>>
    retryFailed: Ref<boolean>
    refresh: ReturnType<typeof vi.fn>
    compare: ReturnType<typeof vi.fn>
    keepServer: ReturnType<typeof vi.fn>
    retryLocal: ReturnType<typeof vi.fn>
    resolveTagName?: (id: string) => string | undefined
    resolveProjectName?: (id: string) => string | undefined
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
        titles: ref({}),
        retryFailed: ref(false),
        refresh: vi.fn(async () => {}),
        compare: vi.fn(async () => {}),
        keepServer: vi.fn(async () => {}),
        retryLocal: vi.fn(async () => {}),
        resolveTagName: () => undefined,
        resolveProjectName: () => undefined
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
    c.titles.value = {}
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
        // DEF-134：左栏标题来自**当前行**（`ux.titles`），不再回退败方快照
        conflict().titles.value = { 'tasks:t1': { name: '本地标题', parentTaskName: null } }
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

    it('DEF-134：无标题来源 ⇒ 表名 + 短 ID（⛔ 不再落裸 entityId / 空白）', async () => {
        await openConflictList(2)
        conflict().items.value = [
            conflictItem({
                id: 'a',
                loser: null,
                entityId: '0f2b9c1d-7a55-4c0e-9f00-6f6f6f6f6f6f',
                table: 'taskComments'
            }),
            conflictItem({ id: 'b', loser: null, entityId: '', kind: 'conflict' })
        ]
        await nextTick()
        const heads = Array.from(
            document.querySelectorAll<HTMLElement>('.conflict-list__entry')
        ).map((el) => el.textContent ?? '')
        expect(heads).toHaveLength(2)
        expect(heads[0]).toContain(messages['zh-CN']['sync.conflict.table.taskComments'])
        expect(heads[0]).toContain('0f2b9c1d')
        expect(heads[0]).not.toContain('0f2b9c1d-7a55-4c0e-9f00-6f6f6f6f6f6f')
        expect(heads[1]).toContain(messages['zh-CN']['sync.conflict.table.tasks'])
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
        conflict().titles.value = { 'tasks:t1': { name: '本地标题', parentTaskName: null } }
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

    it('DEF-134：技术字段默认折叠，点「显示技术信息」后出现在普通字段之后（次要样式）', async () => {
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

        const rowTexts = (): string =>
            Array.from(document.querySelectorAll('.conflict-list__diff-row'))
                .map((el) => el.textContent ?? '')
                .join('|')

        // 默认折叠：主对比区只有业务字段（技术字段不参与）
        expect(rowTexts()).toContain(messages['zh-CN']['sync.conflict.field.name'])
        expect(rowTexts()).not.toContain(messages['zh-CN']['sync.conflict.field.updatedAt'])
        const toggle = document.querySelector<HTMLButtonElement>('.conflict-list__tech-toggle')
        expect(toggle).toBeTruthy()
        expect(toggle?.getAttribute('aria-expanded')).toBe('false')
        expect(toggle?.textContent).toContain(messages['zh-CN']['sync.conflict.showTechnical'])

        // 展开 ⇒ 技术字段出现在普通字段之后，且被标为次要（is-technical）
        toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
        expect(rowTexts()).toContain(messages['zh-CN']['sync.conflict.field.updatedAt'])
        expect(rowTexts()).not.toContain('updatedAt')
        const rows = Array.from(document.querySelectorAll<HTMLElement>('.conflict-list__diff-row'))
        expect(rows.at(-1)?.classList.contains('is-technical')).toBe(true)
        expect(rows.at(-1)?.textContent).toContain(
            messages['zh-CN']['sync.conflict.field.updatedAt']
        )
        expect(
            document.querySelector('.conflict-list__tech-toggle')?.getAttribute('aria-expanded')
        ).toBe('true')
        expect(document.querySelector('.conflict-list__tech-toggle')?.textContent).toContain(
            messages['zh-CN']['sync.conflict.hideTechnical']
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
        expect(document.querySelectorAll('.conflict-list__diff-row')).toHaveLength(0)
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
        expect(src).toContain('.conflict-list__diff-row.is-technical .conflict-list__field-name,')
        expect(src).toContain('color: var(--nue-secondary-text-color);')
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

    it('T355：点击对话框遮罩空白 ⇒ 父面板保持打开、对话框仍开（遮罩不关对话框）', async () => {
        await openConflictList(1)
        await selectObject()
        const overlay = document.querySelector<HTMLElement>('.nue-dialog-overlay')
        expect(overlay, '遮罩存在').toBeTruthy()
        expect(overlay?.className, '遮罩带冲突对话框主题类').toContain('nue-overlay--conflict')
        overlay?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await settle()
        // NueDialog 的遮罩只绑 onEscape、无 onClick ⇒ 点遮罩不关对话框
        expect(document.querySelector('[role="dialog"]')).toBeTruthy()
        // 该 click 不得冒泡到 window 关掉父面板（回归修复点）
        expect(panel()?.getAttribute('data-visible')).toBe('true')
        expect(document.activeElement).not.toBe(document.querySelector('.sync-rail-btn'))
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
describe('DEF-133 详情面板值可读性（不渲染裸 ID / 裸枚举 / 空白）', () => {
    it('tags ⇒ 标签名、state ⇒ 中文标签、空值 ⇒「未设置」', async () => {
        await openConflictList(1)
        const item = conflictItem()
        conflict().items.value = [item]
        conflict().resolveTagName = (id) => (id === 'tag-1' ? '工作' : undefined)
        conflict().comparison.value = {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '标题' },
            current: { name: '标题' },
            diffs: [
                { field: 'tags', loser: ['tag-1'], current: [] },
                { field: 'state', loser: 'todo', current: 'done' }
            ]
        }
        await nextTick()

        const text = dialogText()
        expect(text).toContain('工作')
        expect(text).not.toContain('tag-1')
        expect(text).toContain(messages['zh-CN']['task.state.todo'])
        expect(text).toContain(messages['zh-CN']['task.state.done'])
        // 空数组 ⇒「未设置」（不得空白）
        expect(text).toContain(messages['zh-CN']['sync.conflict.value.unset'])
    })
})

describe('DEF-134 冲突面板可读性（Git diff 左右对照 / 左栏标题 / 窄屏堆叠）', () => {
    /** 挂载并选中一个对象（右栏渲染） */
    const selectWith = async (
        item: ConflictListItem,
        comparison: ConflictComparison
    ): Promise<void> => {
        conflict().items.value = [item]
        conflict().titles.value = {}
        conflict().comparison.value = comparison
        await nextTick()
    }

    const rows = (): HTMLElement[] =>
        Array.from(document.querySelectorAll<HTMLElement>('.conflict-list__diff-row'))

    const sidesOf = (el: Element): string[] =>
        Array.from(el.querySelectorAll<HTMLElement>('[data-side]')).map(
            (node) => node.dataset.side ?? ''
        )

    it('① 固定表头（我的修改 / 云端最新）+ 每行三列（字段 / 左值 / 右值）⇒ 结构对齐', async () => {
        await openConflictList(1)
        await selectWith(conflictItem(), {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '旧', state: 'todo' },
            current: { name: '新', state: 'done' },
            diffs: [
                { field: 'name', loser: '旧', current: '新' },
                { field: 'state', loser: 'todo', current: 'done' }
            ]
        })

        const head = document.querySelector<HTMLElement>('.conflict-list__compare-head')
        expect(head).toBeTruthy()
        // 表头 = 字段列（空）+ 两侧固定表头；文案可读
        expect(sidesOf(head!)).toEqual(['label', 'loser', 'current'])
        expect(head?.textContent).toContain(messages['zh-CN']['sync.conflict.loserLabel'])
        expect(head?.textContent).toContain(messages['zh-CN']['sync.conflict.currentLabel'])

        const list = rows()
        expect(list).toHaveLength(2)
        for (const row of list) {
            // 每行同样三段（字段标签 + 左值 + 右值）⇒ 与表头逐列对齐
            expect(sidesOf(row)).toEqual(['label', 'loser', 'current'])
        }
        // 行高 ≥40px（DESIGN §3 点击区底线）+ 表头 sticky（CSS 契约）
        const src = conflictListSource().replace(/\r/g, '')
        expect(src).toContain('grid-template-columns: min(8rem, 28%) minmax(0, 1fr) minmax(0, 1fr)')
        expect(src).toContain('min-height: var(--nue-box-size-md);')
        expect(src).toContain('position: sticky;')
        expect(src).toContain('top: 0;')
    })

    it('② 三态各自有符号 + 文案（不只看 class，颜色只作强化）', async () => {
        await openConflictList(1)
        await selectWith(conflictItem(), {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '旧', state: 'todo', priority: 1 },
            current: { name: null, state: 'done', priority: null },
            diffs: [
                // 仅左有值 ⇒ 云端已无
                { field: 'priority', loser: 1, current: null },
                // 仅右有值 ⇒ 云端新增
                { field: 'name', loser: null, current: '新' },
                // 两侧不同 ⇒ 已修改
                { field: 'state', loser: 'todo', current: 'done' }
            ]
        })

        const byField = (label: string): HTMLElement => {
            const found = rows().find((row) => row.textContent?.includes(label))
            expect(found, label).toBeTruthy()
            return found as HTMLElement
        }

        const removed = byField(messages['zh-CN']['sync.conflict.field.priority'])
        expect(removed.textContent).toContain('−')
        expect(removed.textContent).toContain(messages['zh-CN']['sync.conflict.fieldRemoved'])
        expect(removed.classList.contains('is-removed')).toBe(true)

        const added = byField(messages['zh-CN']['sync.conflict.field.name'])
        expect(added.textContent).toContain('+')
        expect(added.textContent).toContain(messages['zh-CN']['sync.conflict.fieldAdded'])
        expect(added.classList.contains('is-added')).toBe(true)

        const changed = byField(messages['zh-CN']['sync.conflict.field.state'])
        expect(changed.textContent).toContain('~')
        expect(changed.textContent).toContain(messages['zh-CN']['sync.conflict.fieldChanged'])
        expect(changed.classList.contains('is-changed')).toBe(true)

        // 三态文案必须去色后仍可辨（互异且非空）
        const labels = [
            messages['zh-CN']['sync.conflict.fieldAdded'],
            messages['zh-CN']['sync.conflict.fieldRemoved'],
            messages['zh-CN']['sync.conflict.fieldChanged']
        ]
        expect(new Set(labels).size).toBe(3)
        for (const label of labels) expect(label.trim()).not.toBe('')
    })

    it('③ 左栏显式 text-align: left（根因）+ 长文本单行省略 + title 提示 + 条目高 ≥40px', async () => {
        await openConflictList(1)
        const longTitle = '这是一个很长很长的冲突对象名称'.repeat(6)
        conflict().titles.value = { 'tasks:t1': { name: longTitle, parentTaskName: null } }
        conflict().items.value = [conflictItem()]
        await nextTick()

        const entry = document.querySelector<HTMLButtonElement>('.conflict-list__entry')
        expect(entry?.getAttribute('title')).toBe(longTitle)
        expect(entry?.querySelector('.conflict-list__entry-text')?.textContent).toBe(longTitle)

        // 源级断言：`<button>` 默认居中 ⇒ 必须显式左对齐；长文本单行省略；条目高 ≥40px
        const src = conflictListSource().replace(/\r/g, '')
        const entryRule = src.slice(
            src.indexOf('.conflict-list__entry {'),
            src.indexOf('.conflict-list__entry:hover')
        )
        expect(entryRule).toContain('text-align: left;')
        expect(entryRule).toContain('min-height: var(--nue-box-size-md);')
        const entryTextRule = src.slice(
            src.indexOf('.conflict-list__entry-text {'),
            src.indexOf('.conflict-list__entry:hover')
        )
        expect(entryTextRule).toContain('text-overflow: ellipsis;')
        expect(entryTextRule).toContain('white-space: nowrap;')
    })

    it('④ 标题解析：评论 / 检查项「父任务名 · 摘要」；快照无 name 时**不落裸记录 ID**', async () => {
        await openConflictList(2)
        const commentId = '0f2b9c1d-7a55-4c0e-9f00-6f6f6f6f6f6f'
        const checkItemId = 'b7e4a2f9-1111-2222-3333-444444444444'
        // 败方快照只存差异字段（无 name）—— 走查「只显示记录 ID」的现场
        conflict().titles.value = {
            [`taskComments:${commentId}`]: { name: '晚点再说', parentTaskName: '写周报' },
            [`taskCheckItems:${checkItemId}`]: { name: '买牛奶', parentTaskName: '写周报' }
        }
        conflict().items.value = [
            conflictItem({
                id: 'a',
                kind: 'stale',
                table: 'taskComments',
                entityId: commentId,
                loser: { content: '晚点再说' }
            }),
            conflictItem({
                id: 'b',
                kind: 'stale',
                table: 'taskCheckItems',
                entityId: checkItemId,
                loser: { isDone: true }
            })
        ]
        await nextTick()

        const heads = Array.from(
            document.querySelectorAll<HTMLElement>('.conflict-list__entry')
        ).map((el) => el.textContent?.trim() ?? '')
        expect(heads[0]).toBe('写周报 · 晚点再说')
        expect(heads[1]).toBe('写周报 · 买牛奶')
        for (const head of heads) {
            // 红基线：旧实现（快照回退）会显示整串 entityId ⇒ 必红
            expect(head).not.toContain(commentId)
            expect(head).not.toContain(checkItemId)
        }
    })

    it('④-2 标题来源缺失 ⇒ 表名 + 短 ID（≤8），绝不裸 ID', async () => {
        await openConflictList(1)
        const entityId = '0f2b9c1d-7a55-4c0e-9f00-6f6f6f6f6f6f'
        conflict().items.value = [
            conflictItem({ id: 'a', table: 'taskComments', entityId, loser: null })
        ]
        await nextTick()
        const head =
            document.querySelector<HTMLElement>('.conflict-list__entry')?.textContent?.trim() ?? ''
        expect(head).toBe(`${messages['zh-CN']['sync.conflict.table.taskComments']} · 0f2b9c1d`)
        expect(head).not.toContain(entityId)
    })

    it('⑥ ≤720px 上下堆叠（不隐藏任一侧），>720px 仍为左右两列', async () => {
        const { styleTextOf, parseCssRules, effectiveValue } =
            await import('@/components/pomodoro/records/__tests__/records-responsive-harness')
        const rules = parseCssRules(styleTextOf(conflictListSource()))
        const row = '.conflict-list__diff-row'
        const wide = effectiveValue(rules, row, 'grid-template-columns', 721)
        const narrow = effectiveValue(rules, row, 'grid-template-columns', 720)
        expect(wide).toBe('min(8rem, 28%) minmax(0, 1fr) minmax(0, 1fr)')
        // 吸顶表头的祖先不得成为滚动容器（`overflow: hidden` 会让 sticky 静默失效）
        expect(effectiveValue(rules, '.conflict-list__compare', 'overflow', 1280)).toBeNull()
        expect(narrow).toBe('minmax(0, 1fr)')
        // 堆叠时格内来源标签出现（宽屏由表头承载），且分隔符号出现
        expect(effectiveValue(rules, '.conflict-list__cell-side', 'display', 720)).toBe('block')
        expect(effectiveValue(rules, '.conflict-list__stack-sep', 'display', 720)).toBe('flex')
        expect(effectiveValue(rules, '.conflict-list__stack-sep', 'display', 721)).toBe('none')

        // DOM：两侧格子始终都在（不因窄屏隐藏任一侧）
        await openConflictList(1)
        await selectWith(conflictItem(), {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '旧' },
            current: { name: '新' },
            diffs: [{ field: 'name', loser: '旧', current: '新' }]
        })
        const first = rows()[0]!
        expect(first.querySelector('[data-side="loser"]')?.textContent).toContain('旧')
        expect(first.querySelector('[data-side="current"]')?.textContent).toContain('新')
    })
})