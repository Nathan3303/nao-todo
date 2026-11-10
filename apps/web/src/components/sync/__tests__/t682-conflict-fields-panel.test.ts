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
 * T682 / B 批 M5 —— **面板按字段呈现冲突字段**（真实挂载，⛔ 不用 stub）
 *
 * 契约（M5 卡 / ADR D5）：
 * - 条目带 `conflictFields` ⇒ 对象信息区渲染**字段人话标签**列表（复用 `conflict-field-labels`）；
 * - **零新 i18n 键**（标题复用既有 `sync.conflict.fieldColumn`）；
 * - 条目缺省 `conflictFields`（旧条目 / 整行裁决）⇒ **不渲染该行**（回退既有整行差异展示）。
 */

const t = (key: keyof (typeof messages)['zh-CN']): string => messages['zh-CN'][key]

const makeItem = (conflictFields?: string[]): ConflictListItem => ({
    id: 'tasks:t1:stale',
    kind: 'stale',
    table: 'tasks',
    entityId: 't1',
    loser: { id: 't1', name: '我的版本' },
    winnerUpdatedAt: '2026-10-01T00:00:00.000Z',
    loserUpdatedAt: '2026-09-30T00:00:00.000Z',
    ...(conflictFields === undefined ? {} : { conflictFields }),
    at: '2026-10-01T00:00:00.000Z'
})

const comparison = (): ConflictComparison => ({
    table: 'tasks',
    entityId: 't1',
    loser: { id: 't1', name: '我的版本' },
    current: { id: 't1', name: '云端版本' },
    diffs: [{ field: 'name', loser: '我的版本', current: '云端版本' }]
})

let wrapper: VueWrapper | null = null

const unmountCurrent = (): void => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
}

const mountWith = async (item: ConflictListItem): Promise<void> => {
    const ux = {
        items: ref<ConflictListItem[]>([item]),
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

/** 对象信息区（dl）行：dt 文本 → dd 文本 */
const metaRow = (label: string): string | undefined =>
    Array.from(document.querySelectorAll('.conflict-list__meta-row'))
        .filter((row) => row.querySelector('dt')?.textContent?.trim() === label)
        .map((row) => row.querySelector('dd')?.textContent?.trim() ?? '')[0]

afterEach(() => {
    unmountCurrent()
    vi.restoreAllMocks()
})

describe('T682 / M5 面板按字段呈现（conflictFields）', () => {
    it('条目带 conflictFields ⇒ 渲染字段人话标签（无技术键名）', async () => {
        await mountWith(makeItem(['name', 'priority']))

        const row = metaRow(t('sync.conflict.fieldColumn'))
        expect(row).toBeDefined()
        // 人话标签（复用 conflict-field-labels 的既有 i18n 键）
        expect(row).toContain(t('sync.conflict.field.name'))
        expect(row).toContain(t('sync.conflict.field.priority'))
        // ⛔ 不裸露技术键名
        expect(row).not.toContain('name')
        expect(row).not.toContain('priority')
    })

    it('提醒组冲突 ⇒ 四个字段标签都在（不得只显示单个）', async () => {
        await mountWith(makeItem(['remindAt', 'remindRepeat', 'remindTime', 'remindWeekdays']))

        const row = metaRow(t('sync.conflict.fieldColumn')) ?? ''
        for (const field of ['remindAt', 'remindRepeat', 'remindTime', 'remindWeekdays']) {
            expect(row).toContain(
                t(`sync.conflict.field.${field}` as keyof (typeof messages)['zh-CN'])
            )
        }
    })

    it('条目缺省 conflictFields（旧条目）⇒ 不渲染字段行（回退整行差异展示）', async () => {
        await mountWith(makeItem())

        expect(metaRow(t('sync.conflict.fieldColumn'))).toBeUndefined()
        // 既有整行差异展示仍在（回归护栏）
        expect(document.body.textContent).toContain(t('sync.conflict.compareTitle'))
    })
})