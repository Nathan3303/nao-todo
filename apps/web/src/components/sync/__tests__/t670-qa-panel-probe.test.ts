// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
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
import ConflictList from '../conflict-list.vue'

/**
 * T670 · QA 独立探针（面板收口 · `R-8` / `D6`）
 *
 * 独立路径：**直接挂载 `conflict-list.vue` + 注入 `ux`**（不经过 `SyncStatusBar` / 对话框链路），
 * 逐 kind 断言动作按钮的**真实数量**（⛔ stub / 静态源码断言不算证据）。
 *
 * 契约：`pull-local-wins` ⇒ 「用云端的」**0 个**；`remote-wins`/`push-noop`/`stale` 各 **1 个**；
 *      `conflict`/`skipped` 仍由 `DEF-139` 收口「保留我的修改」= 0 个（不回归）。
 */

const t = (key: keyof (typeof messages)['zh-CN']): string => messages['zh-CN'][key]

const item = (kind: ConflictListItem['kind']): ConflictListItem => ({
    id: `tasks:t1:${kind}`,
    kind,
    table: 'tasks',
    entityId: 't1',
    loser: { name: '云端当时的版本' },
    winnerUpdatedAt: '2026-10-01T00:00:00.000Z',
    loserUpdatedAt: '2026-09-30T00:00:00.000Z',
    at: '2026-10-01T00:00:00.000Z'
})

const comparison = (): ConflictComparison => ({
    table: 'tasks',
    entityId: 't1',
    loser: { name: '云端当时的版本' },
    current: { name: '我的当前版本' },
    diffs: [{ field: 'name', loser: '云端当时的版本', current: '我的当前版本' }]
})

let wrapper: VueWrapper | null = null

const mountWith = async (kind: ConflictListItem['kind']): Promise<void> => {
    const ux = {
        items: ref<ConflictListItem[]>([item(kind)]),
        folded: ref(false),
        foldedReason: ref<'limit' | 'evicted' | null>(null),
        loading: ref(false),
        error: ref<string | null>(null),
        comparison: ref<ConflictComparison | null>(comparison()),
        titles: ref({}),
        retryFailed: ref(false),
        keepServerPending: ref(false),
        keepServerFailed: ref(false),
        refresh: vi.fn(async () => {}),
        compare: vi.fn(async () => {}),
        keepServer: vi.fn(async () => ({ status: 'cleared' })),
        retryLocal: vi.fn(async () => {}),
        resolveTagName: () => undefined,
        resolveProjectName: () => undefined
    }
    wrapper = mount(ConflictList, {
        attachTo: document.body,
        props: { ux: ux as never },
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
    await nextTick()
    await nextTick()
}

const actionButtons = (label: string): HTMLButtonElement[] =>
    Array.from(
        document.querySelectorAll<HTMLButtonElement>('.conflict-list__actions button')
    ).filter((button) => button.textContent?.includes(label))

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('T670 探针 E：面板动作按钮按 kind 收口（真实挂载）', () => {
    it('E1 pull-local-wins ⇒ 「用云端的」0 个；「保留我的修改」1 个；关闭 1 个', async () => {
        await mountWith('pull-local-wins')

        expect(document.querySelector('.conflict-list')).toBeTruthy()
        expect(actionButtons(t('sync.conflict.keepServer'))).toHaveLength(0)
        expect(actionButtons(t('sync.conflict.retryLocal'))).toHaveLength(1)
        expect(actionButtons(t('sync.conflict.close'))).toHaveLength(1)
        // 该 kind 的左右侧语义标签仍是专用文案（沿用既有键，零新增文案）
        expect(document.body.textContent).toContain(t('sync.conflict.pullLocalWinsLoserLabel'))
        expect(document.body.textContent).toContain(t('sync.conflict.pullLocalWinsCurrentLabel'))
    })

    it.each(['stale', 'remote-wins', 'push-noop'] as const)(
        'E2 %s ⇒ 「用云端的」仍渲染 1 个（零行为变化）',
        async (kind) => {
            await mountWith(kind)
            expect(actionButtons(t('sync.conflict.keepServer'))).toHaveLength(1)
            expect(actionButtons(t('sync.conflict.retryLocal'))).toHaveLength(1)
        }
    )

    it.each(['conflict', 'skipped'] as const)(
        'E3 %s ⇒ DEF-139 不回归：「保留我的修改」0 个 + 需手动处理说明可见',
        async (kind) => {
            await mountWith(kind)
            expect(actionButtons(t('sync.conflict.retryLocal'))).toHaveLength(0)
            expect(document.body.textContent).toContain(t('sync.conflict.manualRecoveryHint'))
        }
    )

    it('E4 边界事实：pull-local-wins 无「复制我的修改」按钮（复制入口仅 conflict/skipped）', async () => {
        await mountWith('pull-local-wins')
        // 事实断言：本批未新增复制入口；面板无该按钮（可否复制见报告「观察项」）
        expect(document.querySelectorAll('.conflict-list__manual button')).toHaveLength(0)
        const copyButtons = Array.from(document.querySelectorAll('button')).filter((button) =>
            button.textContent?.includes(t('sync.conflict.copyLoser'))
        )
        expect(copyButtons).toHaveLength(0)
    })
})