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
    NueTable,
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
// T704 / D2：字段标签表唯一真源已下沉 `packages/shared`
// ⇒ 扫描面同步扩到该模块（判据不变：仍是「死键集合为空」）
const conflictComponentSources = import.meta.glob(
    ['../*.{vue,ts}', '/packages/shared/utils/conflict-field-labels.ts'],
    {
        query: '?raw',
        import: 'default',
        eager: true
    }
) as Record<string, string>

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
                'nue-table': NueTable,
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

    it('DEF-136：技术字段**并入同一张表**（排在业务字段之后），无折叠开关', async () => {
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

        // 技术字段默认可见，且与业务字段在同一张 `nue-table` 内（不分容器、不需点击）
        const table = document.querySelector<HTMLElement>('.conflict-list__diff-table table')
        expect(table).toBeTruthy()
        const rowTexts = Array.from(table?.querySelectorAll('tbody tr') ?? []).map(
            (el) => el.textContent ?? ''
        )
        expect(rowTexts).toHaveLength(2)
        expect(rowTexts[0]).toContain(messages['zh-CN']['sync.conflict.field.name'])
        expect(rowTexts[1]).toContain(messages['zh-CN']['sync.conflict.field.updatedAt'])
        expect(rowTexts.join('|')).not.toContain('updatedAt')

        // 次要样式（技术字段在业务字段之后 ⇒ 末行标记 is-technical）
        const lastRow = table?.querySelectorAll('tbody tr')[1]
        expect(
            lastRow?.querySelector('.conflict-list__diff-label')?.classList.contains('is-technical')
        ).toBe(true)

        // ⛔ 折叠开关与其 i18n 键已删除（死键守护另有用例）
        expect(document.querySelector('.conflict-list__tech-toggle')).toBeFalsy()
        const src = conflictListSource()
        expect(src).not.toContain('showTechnical')
        expect(src).not.toContain('hideTechnical')
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
        expect(document.querySelectorAll('.conflict-list__diff-table tbody tr')).toHaveLength(0)
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
        expect(src).toContain('.conflict-list__diff-label.is-technical .conflict-list__field-name,')
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
        Array.from(document.querySelectorAll<HTMLElement>('.conflict-list__diff-table tbody tr'))

    const sidesOf = (el: Element): string[] =>
        Array.from(el.querySelectorAll<HTMLElement>('[data-side]')).map(
            (node) => node.dataset.side ?? ''
        )

    it('① 差异区 = `nue-table` 三列（字段 / 我的修改 / 云端最新），字段名与值在同一 `tr`', async () => {
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

        const table = document.querySelector<HTMLElement>('.conflict-list__diff-table table')
        expect(table, '差异区渲染为 nue-table').toBeTruthy()
        expect(table?.classList.contains('nue-table__table')).toBe(true)

        // 表头三列：字段 / 我的修改 / 云端最新（文案可读）
        const heads = Array.from(table?.querySelectorAll<HTMLElement>('th') ?? [])
        expect(heads).toHaveLength(3)
        expect(heads.map((th) => th.textContent?.trim() ?? '')).toEqual([
            messages['zh-CN']['sync.conflict.fieldColumn'],
            messages['zh-CN']['sync.conflict.loserLabel'],
            messages['zh-CN']['sync.conflict.currentLabel']
        ])

        // 每行三格共存 ⇒ 字段名与两侧值**同一行**（这正是改用表格的原因）
        const list = rows()
        expect(list).toHaveLength(2)
        for (const row of list) {
            expect(row.querySelectorAll('td')).toHaveLength(3)
            expect(sidesOf(row)).toEqual(['field', 'loser', 'current'])
        }
        const firstCells = Array.from(list[0]?.querySelectorAll('td') ?? [])
        expect(firstCells[0]?.textContent).toContain(messages['zh-CN']['sync.conflict.field.name'])
        expect(firstCells[1]?.textContent).toContain('旧')
        expect(firstCells[2]?.textContent).toContain('新')

        // 列宽契约：字段列 `8rem`（≤720px `6rem`）；两个值列**不设宽** ⇒ fixed 布局下等分剩余宽度
        expect(heads[0]?.style.width).toBe('var(--conflict-diff-field-col)')
        expect(heads[1]?.style.width).toBe('')
        expect(heads[2]?.style.width).toBe('')
        const { styleTextOf, parseCssRules, effectiveValue } =
            await import('@/components/pomodoro/records/__tests__/records-responsive-harness')
        const rules = parseCssRules(styleTextOf(conflictListSource()))
        expect(
            effectiveValue(rules, '.conflict-list__diff-table', '--conflict-diff-field-col', 1280)
        ).toBe('8rem')
        expect(
            effectiveValue(rules, '.conflict-list__diff-table', '--conflict-diff-field-col', 720)
        ).toBe('6rem')
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
        const kindOf = (row: HTMLElement): boolean[] =>
            ['is-removed', 'is-added', 'is-changed'].map(
                (kind) =>
                    row.querySelector('.conflict-list__diff-label')?.classList.contains(kind) ===
                    true
            )

        const removed = byField(messages['zh-CN']['sync.conflict.field.priority'])
        expect(removed.textContent).toContain('−')
        expect(removed.textContent).toContain(messages['zh-CN']['sync.conflict.fieldRemoved'])
        expect(kindOf(removed)).toEqual([true, false, false])

        const added = byField(messages['zh-CN']['sync.conflict.field.name'])
        expect(added.textContent).toContain('+')
        expect(added.textContent).toContain(messages['zh-CN']['sync.conflict.fieldAdded'])
        expect(kindOf(added)).toEqual([false, true, false])

        const changed = byField(messages['zh-CN']['sync.conflict.field.state'])
        expect(changed.textContent).toContain('~')
        expect(changed.textContent).toContain(messages['zh-CN']['sync.conflict.fieldChanged'])
        expect(kindOf(changed)).toEqual([false, false, true])

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

    it('⑥ ≤720px：仍三列（字段列收窄），取消原「上下堆叠」（表格即对齐方案）', async () => {
        const { styleTextOf, parseCssRules, effectiveValue } =
            await import('@/components/pomodoro/records/__tests__/records-responsive-harness')
        const rules = parseCssRules(styleTextOf(conflictListSource()))
        const src = conflictListSource().replace(/\r/g, '')

        // 单列 / 隐藏表头 / 格内来源标签 / 堆叠分隔符 一律不得残留（两套布局 ⇒ 漂移）
        expect(src).not.toContain('.conflict-list__stack-sep')
        expect(src).not.toContain('.conflict-list__cell-side')
        const narrow = src.slice(src.indexOf('@media (max-width: 720px)'))
        expect(narrow.slice(0, narrow.indexOf('\n}\n'))).not.toContain('grid-template-columns')
        expect(narrow.slice(0, narrow.indexOf('\n}\n'))).not.toContain('display: none')

        // 窄屏只收窄字段列（8rem → 6rem），值列仍为两列
        expect(
            effectiveValue(rules, '.conflict-list__diff-table', '--conflict-diff-field-col', 720)
        ).toBe('6rem')

        // DOM：两侧值仍在同一 `tr` 的两格里（不隐藏任一侧）
        await openConflictList(1)
        await selectWith(conflictItem(), {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '旧' },
            current: { name: '新' },
            diffs: [{ field: 'name', loser: '旧', current: '新' }]
        })
        const first = rows()[0]!
        expect(first.querySelectorAll('td')).toHaveLength(3)
        expect(first.querySelector('[data-side="loser"]')?.textContent).toContain('旧')
        expect(first.querySelector('[data-side="current"]')?.textContent).toContain('新')
    })
})

describe('DEF-135 详情值纯文本（去框）+ pull-local-wins 表头文案', () => {
    /** 挂载并带一条差异（右栏渲染可比对行） */
    const renderDiff = async (): Promise<void> => {
        await openConflictList(1)
        conflict().items.value = [conflictItem()]
        conflict().comparison.value = {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '旧', state: 'todo', priority: 1 },
            current: { name: '新', state: 'done', priority: null },
            diffs: [
                { field: 'priority', loser: 1, current: null },
                { field: 'name', loser: null, current: '新' },
                { field: 'state', loser: 'todo', current: 'done' }
            ]
        }
        await nextTick()
    }

    it('① 值格无框：无 border / background / border-radius / padding（宽窄屏均如此）', async () => {
        const { styleTextOf, parseCssRules, effectiveValue } =
            await import('@/components/pomodoro/records/__tests__/records-responsive-harness')
        const rules = parseCssRules(styleTextOf(conflictListSource()))
        // 旧实现的「带边框 + 底色 + 圆角 + 内边距」块状值格（三态还各自染色）
        const cells = [
            '.conflict-list__diff-cell',
            '.conflict-list__diff-cell.is-loser',
            '.conflict-list__diff-cell.is-current'
        ]
        for (const width of [1280, 720]) {
            for (const cell of cells) {
                for (const prop of [
                    'border',
                    'border-radius',
                    'background',
                    'background-color',
                    'padding'
                ]) {
                    expect(
                        effectiveValue(rules, cell, prop, width),
                        `${cell}@${width} ${prop}`
                    ).toBeNull()
                }
            }
        }
        // 三态不得再给值格上色块（红基线：is-removed ↔ error-80/10、is-added ↔ success-80/10、
        // is-changed ↔ warning-80 + primary-100）
        const src = conflictListSource().replace(/\r/g, '')
        expect(src).not.toMatch(/^[.:][^\n]*\{[^}]*-color-10\)/m)
        expect(src).not.toMatch(/is-changed[^{]*\{[^}]*--nue-warning-color-80/)
        // 值本身（`span`）同样无框：纯文本
        for (const prop of [
            'border',
            'border-radius',
            'background',
            'background-color',
            'padding'
        ]) {
            expect(effectiveValue(rules, '.conflict-list__text', prop, 1280)).toBeNull()
        }
        // 表格不加框 / 无斑马纹（主题默认 `--nue-table-border-color: transparent`）
        expect(src).not.toContain('nue-table--border')
        expect(src).not.toContain('nue-table--striped')
        // 行悬停底色（数据表气质）显式关闭（覆写既有 token，不新增色值）
        expect(src).toContain('--nue-table-row-hover-bg-color: transparent;')
    })

    it('② 三态仍靠「符号 + 文案 + 文字色」承载（去框后不丢可辨性）', async () => {
        await renderDiff()
        const rows = (): HTMLElement[] =>
            Array.from(
                document.querySelectorAll<HTMLElement>('.conflict-list__diff-table tbody tr')
            )
        const byField = (label: string): HTMLElement => {
            const found = rows().find((row) => row.textContent?.includes(label))
            expect(found, label).toBeTruthy()
            return found as HTMLElement
        }

        for (const [label, symbol, kind] of [
            ['sync.conflict.field.priority', '−', 'is-removed'],
            ['sync.conflict.field.name', '+', 'is-added'],
            ['sync.conflict.field.state', '~', 'is-changed']
        ] as const) {
            const row = byField(messages['zh-CN'][label])
            expect(row.querySelector('.conflict-list__diff-label')?.classList.contains(kind)).toBe(
                true
            )
            expect(row.textContent).toContain(symbol)
            expect(row.querySelector('.conflict-list__state-label')?.textContent?.trim()).not.toBe(
                ''
            )
        }

        // 文字色随三态（源级契约；对比度按白底：error -90 = 8.97 / success -100 = 5.67）
        const src = conflictListSource().replace(/\r/g, '')
        expect(src).toContain(
            '.conflict-list__diff-cell.is-removed .conflict-list__text {\n    color: var(--nue-error-color-90);'
        )
        expect(src).toContain(
            '.conflict-list__diff-cell.is-added .conflict-list__text {\n    color: var(--nue-success-color-100);'
        )
        // 两侧都有值（changed）⇒ 常规正文色（不再区分两侧颜色 / 字重）
        expect(src).not.toMatch(/^\.conflict-list__diff-cell\.is-loser \.conflict-list__text \{/m)
        expect(src).not.toMatch(/^\.conflict-list__diff-cell\.is-current \.conflict-list__text \{/m)
    })

    it('③ 表头文案：pull-local-wins ⇒「云端当时的版本 / 我的当前版本」；其它 kind 不变', async () => {
        const zh = messages['zh-CN']
        // 文案本身（zh/en 各一处，类型齐备）
        expect(zh['sync.conflict.pullLocalWinsLoserLabel']).toBe('云端当时的版本')
        expect(zh['sync.conflict.pullLocalWinsCurrentLabel']).toBe('我的当前版本')
        expect(messages['en-US']['sync.conflict.pullLocalWinsLoserLabel']).toBe(
            'Cloud version at the time'
        )
        // 其余 kind 的两侧标签不动
        expect(zh['sync.conflict.loserLabel']).toBe('我的修改')
        expect(zh['sync.conflict.currentLabel']).toBe('云端最新')

        const headText = (): string =>
            document.querySelector('.conflict-list__diff-table thead')?.textContent ?? ''

        await openConflictList(1)
        conflict().items.value = [conflictItem({ kind: 'pull-local-wins' })]
        conflict().comparison.value = {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '云端旧名' },
            current: { name: '本地新名' },
            diffs: [{ field: 'name', loser: '云端旧名', current: '本地新名' }]
        }
        await nextTick()
        expect(headText()).toContain('云端当时的版本')
        expect(headText()).toContain('我的当前版本')
        expect(headText()).not.toContain('云端未保留的版本')

        // 其它 kind（stale）沿用默认标签
        conflict().items.value = [conflictItem({ kind: 'stale' })]
        await nextTick()
        expect(headText()).toContain(zh['sync.conflict.loserLabel'])
        expect(headText()).toContain(zh['sync.conflict.currentLabel'])
        expect(headText()).not.toContain('云端当时的版本')
    })
})
describe('DEF-136 差异区改 `nue-table`（技术字段并入主表 / 不加框 / 窄屏仍三列）', () => {
    const renderWith = async (): Promise<void> => {
        await openConflictList(1)
        conflict().items.value = [conflictItem()]
        conflict().comparison.value = {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '旧标题', updatedAt: '2026-11-01T00:00:00.000Z' },
            current: { name: '新标题', updatedAt: '2026-11-02T00:00:00.000Z' },
            diffs: [
                { field: 'name', loser: '旧标题', current: '新标题' },
                {
                    field: 'updatedAt',
                    loser: '2026-11-01T00:00:00.000Z',
                    current: '2026-11-02T00:00:00.000Z'
                }
            ]
        }
        await nextTick()
    }

    it('① 差异区是 `nue-table`（三列 / 同一 `tr` 内三格共存）+ 字段列宽契约', async () => {
        await renderWith()

        const root = document.querySelector<HTMLElement>('.conflict-list__diff-table')
        expect(root?.classList.contains('nue-table')).toBe(true)
        const table = root?.querySelector<HTMLElement>('table.nue-table__table')
        expect(table).toBeTruthy()

        const rows = Array.from(table?.querySelectorAll<HTMLElement>('tbody tr') ?? [])
        expect(rows).toHaveLength(2)
        // 字段名与两个值在**同一行**（旧 grid 方案「不在一条线」的验收点）
        for (const row of rows) {
            const cells = Array.from(row.querySelectorAll<HTMLElement>('td'))
            expect(cells).toHaveLength(3)
            expect(cells[0]?.querySelector('.conflict-list__field-name')).toBeTruthy()
            expect(cells[1]?.querySelector('.conflict-list__text')).toBeTruthy()
            expect(cells[2]?.querySelector('.conflict-list__text')).toBeTruthy()
        }
        expect(rows[0]?.textContent).toContain(messages['zh-CN']['sync.conflict.field.name'])
        expect(rows[0]?.textContent).toContain('旧标题')
        expect(rows[0]?.textContent).toContain('新标题')

        // 列宽：字段列 `8rem`（窄屏 `6rem`）+ 两值列不设宽 ⇒ `table-layout: fixed` 等分
        const ths = Array.from(table?.querySelectorAll<HTMLElement>('thead th') ?? [])
        expect(ths).toHaveLength(3)
        expect(ths[0]?.style.width).toBe('var(--conflict-diff-field-col)')
        expect(ths[1]?.style.width).toBe('')
        expect(ths[2]?.style.width).toBe('')
    })

    it('② 同一 `tr` 内三格基线一致（CSS 契约；jsdom 无布局 ⇒ 不声称量到像素）', async () => {
        const { styleTextOf, parseCssRules, effectiveValue } =
            await import('@/components/pomodoro/records/__tests__/records-responsive-harness')
        const rules = parseCssRules(styleTextOf(conflictListSource()))
        // 单元格显式 `vertical-align: baseline` ⇒ 字段名与值首行同基线（宽窄屏一致）
        for (const width of [1280, 720]) {
            expect(
                effectiveValue(rules, ':deep(.nue-table__cell)', 'vertical-align', width),
                `@${width}`
            ).toBe('baseline')
        }
        // 字段格与值格自身也按基线对齐（inline-flex / 文本）
        expect(effectiveValue(rules, '.conflict-list__diff-label', 'align-items', 1280)).toBe(
            'baseline'
        )
    })

    it('③ 技术字段在同一张表内（不折叠），折叠开关与其 i18n 键已删除', async () => {
        await renderWith()

        const table = document.querySelector('.conflict-list__diff-table table')
        expect(
            Array.from(table?.querySelectorAll<HTMLElement>('tbody tr') ?? []).at(-1)?.textContent
        ).toContain(messages['zh-CN']['sync.conflict.field.updatedAt'])
        // 不是折叠容器：没有 details / collapse 包裹技术字段
        expect(document.querySelector('.conflict-list__diff-table details')).toBeFalsy()
        expect(document.querySelector('.conflict-list__diff-table .nue-collapse')).toBeFalsy()

        // 源级：开关与键彻底移除（死键守护 + 复现性）
        const src = conflictListSource()
        expect(src).not.toContain('technicalOpen')
        expect(src).not.toContain('conflict-list__tech-toggle')
        expect(src).not.toContain('showTechnical')
        expect(src).not.toContain('hideTechnical')
        expect(messages['zh-CN']).not.toHaveProperty('sync.conflict.showTechnical')
        expect(messages['zh-CN']).not.toHaveProperty('sync.conflict.hideTechnical')
        expect(messages['en-US']).not.toHaveProperty('sync.conflict.showTechnical')
        expect(messages['en-US']).not.toHaveProperty('sync.conflict.hideTechnical')
    })

    it('④ 无框 / 无斑马纹：不启用 `--border` / `--striped`，单元格不自设 border/背景/圆角', async () => {
        await renderWith()

        const root = document.querySelector<HTMLElement>('.conflict-list__diff-table')
        expect(root?.className).not.toContain('nue-table--border')
        expect(root?.className).not.toContain('nue-table--striped')
        // 只作对齐容器：无排序 / 行点击（`th` 不可排序、行无 click 处理器）
        expect(
            document.querySelectorAll('.conflict-list__diff-table .nue-table__head-cell--sortable')
        ).toHaveLength(0)
        expect(
            document.querySelectorAll('.conflict-list__diff-table .nue-table__sort-icon')
        ).toHaveLength(0)

        const { styleTextOf, parseCssRules, effectiveValue } =
            await import('@/components/pomodoro/records/__tests__/records-responsive-harness')
        const rules = parseCssRules(styleTextOf(conflictListSource()))
        for (const cell of ['.conflict-list__diff-cell', '.conflict-list__diff-label']) {
            for (const prop of ['border', 'border-radius', 'background', 'background-color']) {
                expect(effectiveValue(rules, cell, prop, 1280), `${cell} ${prop}`).toBeNull()
            }
        }
    })

    it('⑤ 长值：单元格默认单行省略 + `title`；展开后**该单元格**允许换行', async () => {
        const longText = '很长的内容'.repeat(40)
        await openConflictList(1)
        conflict().items.value = [conflictItem()]
        conflict().comparison.value = {
            table: 'tasks',
            entityId: 't1',
            loser: { description: longText },
            current: { description: '短' },
            diffs: [{ field: 'description', loser: longText, current: '短' }]
        }
        await nextTick()

        const cell = document.querySelector<HTMLElement>(
            '.conflict-list__diff-table [data-side="loser"]'
        )
        const text = cell?.querySelector<HTMLElement>('.conflict-list__text')
        expect(text?.textContent).toBe(longText)
        expect(text?.getAttribute('title')).toBe(longText)

        const toggle = cell?.querySelector<HTMLButtonElement>('.conflict-list__value-toggle')
        expect(toggle?.getAttribute('aria-expanded')).toBe('false')
        toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await nextTick()
        expect(toggle?.getAttribute('aria-expanded')).toBe('true')
        expect(text?.classList.contains('is-expanded')).toBe(true)
        // 展开态不再挂在 `title`（完整值已在可见区）
        expect(text?.getAttribute('title')).toBeNull()

        // CSS 契约：默认 nowrap 省略；展开后该单元格换行 + 高度上限（不撑破对话框）
        const { styleTextOf, parseCssRules, effectiveValue } =
            await import('@/components/pomodoro/records/__tests__/records-responsive-harness')
        const rules = parseCssRules(styleTextOf(conflictListSource()))
        expect(effectiveValue(rules, '.conflict-list__text', 'white-space', 1280)).toBe('nowrap')
        expect(effectiveValue(rules, '.conflict-list__text', 'text-overflow', 1280)).toBe(
            'ellipsis'
        )
        expect(effectiveValue(rules, '.conflict-list__text', 'max-height', 1280)).toBeNull()
        expect(effectiveValue(rules, '.conflict-list__text.is-expanded', 'white-space', 1280)).toBe(
            'pre-wrap'
        )
        expect(effectiveValue(rules, '.conflict-list__text.is-expanded', 'max-height', 1280)).toBe(
            '7.5rem'
        )
    })
})
/**
 * DEF-139（UI 侧）：「保留我的修改」只对**可自动恢复**的类型渲染
 * @description `pull-local-wins` 必须出现（此前点了才报「该类型不支持」）；
 *              `conflict` / `skipped` 属本批**不可自动恢复** ⇒ **不渲染**该按钮，改由「需手动处理」说明 + 复制入口承载，
 *              杜绝"点了才报错"；`sync.conflict.retryFailed` 仅留作真异常兜底（仍可见，见既有用例）。
 */
describe('DEF-139 动作 B 仅对可恢复类型渲染（同源判据）', () => {
    const retryLabel = (): string => messages['zh-CN']['sync.conflict.retryLocal']
    const manualHint = (): string => messages['zh-CN']['sync.conflict.manualRecoveryHint']
    const copyLabel = (): string => messages['zh-CN']['sync.conflict.copyLoser']

    const openWith = async (kind: ConflictListItem['kind']): Promise<void> => {
        await openConflictList(1)
        conflict().items.value = [conflictItem({ kind })]
        conflict().comparison.value = {
            table: 'tasks',
            entityId: 't1',
            loser: { name: '我的版本' },
            current: { name: '云端最新' },
            diffs: [{ field: 'name', loser: '我的版本', current: '云端最新' }]
        }
        await nextTick()
    }

    it('pull-local-wins ⇒ 「保留我的修改」可见且可点（不再报类型不支持）', async () => {
        await openWith('pull-local-wins')

        const button = actionButton(retryLabel())
        expect(button).toBeTruthy()
        expect(dialogText()).not.toContain(messages['zh-CN']['sync.conflict.retryFailed'])

        button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await settle()
        expect(conflict().retryLocal).toHaveBeenCalledWith(
            conflictItem({ kind: 'pull-local-wins' })
        )
    })

    it('conflict / skipped ⇒ **不渲染**该按钮，改给「需手动处理」说明 + 复制入口', async () => {
        for (const kind of ['conflict', 'skipped'] as const) {
            await openWith(kind)

            expect(actionButton(retryLabel()), kind).toBeFalsy()
            expect(dialogText(), kind).toContain(manualHint())
            // 复制入口在「需手动处理」区内（不在底部动作栏）
            expect(
                document.querySelector('.conflict-list__manual button')?.textContent,
                kind
            ).toContain(copyLabel())
            // 另两种动作仍在（只收敛动作 B）
            expect(actionButton(messages['zh-CN']['sync.conflict.keepServer']), kind).toBeTruthy()
            expect(actionButton(messages['zh-CN']['sync.conflict.close']), kind).toBeTruthy()
        }
    })

    it('既有三类仍渲染该按钮（remote-wins / push-noop / stale）', async () => {
        for (const kind of ['remote-wins', 'push-noop', 'stale'] as const) {
            await openWith(kind)
            expect(actionButton(retryLabel()), kind).toBeTruthy()
        }
    })
})