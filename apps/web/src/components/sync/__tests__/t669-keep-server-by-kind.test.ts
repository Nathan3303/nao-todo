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
import type {
    ConflictComparison,
    ConflictListItem
} from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'
import { messages } from '@nao-todo/shared/locales'
import SyncStatusBar from '../sync-status-bar.vue'
import { bindRailBottomHost, unbindRailBottomHost } from '@/components/app/aside-v2/rail-host'
import { resetReadOnlyForTest } from '@nao-todo/presentation/offline'

/**
 * T669 / `DEF-146`（`R-8` / PM 裁定 `D6`）—— 「保留服务端版本」按 kind 收口
 *
 * 契约：该动作只有 `stale` 会**真写回**；`pull-local-wins` 点了只清条目 ⇒ 对用户是误导
 *      （「保留服务端」实际不会拿回云端内容）⇒ **不渲染**，改由「复制」入口承载。
 *      `remote-wins` / `push-noop` 语义上服务端已是胜方 ⇒ 保留原渲染（零行为变化）。
 *
 * ⚠️ 必须**真实挂载**组件断言按钮数（stub / 静态源码断言不算证据，见 AGENTS.md 前端验证纪律）。
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
}

const hooksMock = vi.hoisted(() => ({
    status: undefined as unknown,
    conflict: undefined as unknown
}))

vi.mock('@/hooks', async () => {
    const { ref } = await import('vue')
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
        retryLocal: vi.fn(async () => {})
    }
    hooksMock.status = status
    hooksMock.conflict = conflict
    return {
        useSyncStatus: () => ({ status }),
        useManualSync: () => ({ syncing: ref(false), run: vi.fn() }),
        useMirrorLoadedCount: () => ref(0),
        useConflictUx: () => conflict
    }
})

const status = (): Ref<MockSyncStatus> => hooksMock.status as Ref<MockSyncStatus>
const conflict = (): MockConflictUx => hooksMock.conflict as MockConflictUx

const conflictItem = (kind: ConflictListItem['kind']): ConflictListItem => ({
    id: `tasks:t1:${kind}`,
    kind,
    table: 'tasks',
    entityId: 't1',
    loser: { name: '云端当时的版本' },
    winnerUpdatedAt: '2026-09-24T00:00:00.000Z',
    loserUpdatedAt: '2026-09-23T00:00:00.000Z',
    at: '2026-09-24T00:00:00.000Z'
})

vi.stubGlobal(
    'ResizeObserver',
    class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }
)

let wrapper: VueWrapper | null = null

const settle = async (): Promise<void> => {
    await nextTick()
    await nextTick()
}

const createHost = (): HTMLElement => {
    const host = document.createElement('div')
    host.id = 'AppAsideRailBottomSlot'
    document.body.appendChild(host)
    bindRailBottomHost(host)
    return host
}

const openPanel = (): void => {
    document
        .querySelector<HTMLButtonElement>('.sync-rail-btn')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

const conflictEntry = (): Element | undefined =>
    document
        .querySelector<HTMLElement>('.nue-dropdown--sync-panel')
        ?.querySelector('.sync-conflict-entry') ?? undefined

const openWith = async (kind: ConflictListItem['kind']): Promise<void> => {
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
    await settle()
    openPanel()
    await settle()
    status().value = { ...status().value, conflictCount: 1 }
    await nextTick()
    conflictEntry()?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await settle()

    const item = conflictItem(kind)
    conflict().items.value = [item]
    conflict().comparison.value = {
        table: 'tasks',
        entityId: 't1',
        loser: { name: '云端当时的版本' },
        current: { name: '我的当前版本' },
        diffs: [{ field: 'name', loser: '云端当时的版本', current: '我的当前版本' }]
    }
    await settle()
    document
        .querySelector<HTMLButtonElement>('.conflict-list__entry')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await settle()
}

/** 底部动作栏里的按钮（按文案定位，命中数为证） */
const actionButtons = (label: string): HTMLButtonElement[] =>
    Array.from(
        document.querySelectorAll<HTMLButtonElement>('.conflict-list__actions button')
    ).filter((button) => button.textContent?.includes(label))

beforeEach(() => {
    status().value = { ...status().value, conflictCount: 0 }
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

describe('T669 / R-8：「保留服务端版本」按 kind 收口（真实挂载断言按钮数）', () => {
    const keepServerLabel = (): string => messages['zh-CN']['sync.conflict.keepServer']

    it('pull-local-wins ⇒ 该按钮 **0 个**（复制入口承载查看/复制）', async () => {
        await openWith('pull-local-wins')

        expect(document.querySelector('.conflict-list'), '列表已挂载').toBeTruthy()
        expect(actionButtons(keepServerLabel())).toHaveLength(0)
        // 其余动作仍在：关闭
        expect(actionButtons(messages['zh-CN']['sync.conflict.close'])).toHaveLength(1)
    })

    it.each(['stale', 'remote-wins', 'push-noop'] as const)(
        '%s ⇒ 该按钮仍渲染 1 个（零行为变化）',
        async (kind) => {
            await openWith(kind)
            expect(actionButtons(keepServerLabel())).toHaveLength(1)
        }
    )
})