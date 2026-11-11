// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, provide, ref } from 'vue'
import { NueButton, NueCollapse, NueCollapseItem, NueDiv, NueEmpty, NueIcon, NueText } from 'nue-ui'
import { messages, t } from '@nao-todo/shared/locales'
import { TASK_DETAILS_CONTEXT_KEY, TASK_HISTORY_CONTEXT_KEY } from '../../context'
import HistoryPanel from '../history.vue'

/**
 * T706 · 面板**真挂载**复核（QA 自写探针；⛔ 不 stub 被测组件，只注入 provider）
 *
 * 独立于 `t697-ac3` 的复核点（PM T706 #5）：
 * ① 13 个 `history.*` 键**中英齐备**（值非空、同键集）；
 * ② **可见文本**无内部词：`source` / `action` / `field` / `seq` / `plain:` / `local-edit` /
 *    `push-merge` / `conflict-retry` / `fieldBase` / `revision`（注意：类名含 `__source` 等属实现细节，
 *    判据是**用户可见文本**，故用 `text()` 而非 `html()`；`plain:` 额外在 `html()` 上也判一次）；
 * ③ 非表格式：无 `<table>` / `nue-table`；
 * ④ `unavailable` 与「可用但 0 条」**都**显示「暂无变更记录」，且**都不**显示「加载失败」；
 * ⑤ 来源 / 动作 / 字段一律中文（复用字段标签 + 13 键）。
 */

const NUE = {
    'nue-button': NueButton,
    'nue-collapse': NueCollapse,
    'nue-collapse-item': NueCollapseItem,
    'nue-div': NueDiv,
    'nue-empty': NueEmpty,
    'nue-icon': NueIcon,
    'nue-text': NueText
}

interface ProbeItem {
    seq: number
    at: string
    source: 'local-edit' | 'pull' | 'push-merge' | 'conflict-retry'
    action: 'create' | 'update' | 'archive' | 'unarchive' | 'delete' | 'restore'
    fields: Array<{ field: string; from: unknown; to: unknown }>
}

interface ProbePage {
    items: ProbeItem[]
    hasMore: boolean
    unavailable: boolean
}

const flush = async (): Promise<void> => {
    for (let index = 0; index < 6; index += 1) {
        await nextTick()
        await Promise.resolve()
    }
}

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

const mountPanel = async (page: ProbePage): Promise<VueWrapper> => {
    const load = vi.fn(async (_taskId: string, _beforeSeq?: number) => page)
    const Host = defineComponent({
        components: { HistoryPanel },
        setup() {
            provide(TASK_DETAILS_CONTEXT_KEY, { vo: ref({ id: 'task-qa' }) } as never)
            provide(TASK_HISTORY_CONTEXT_KEY, { load } as never)
            return {}
        },
        template: '<history-panel />'
    })
    wrapper = mount(Host, { global: { components: NUE } })
    await flush()
    const collapse = wrapper.findComponent(NueCollapse)
    if (collapse.exists()) {
        collapse.vm.$emit('update:modelValue', ['history'])
        await flush()
    }
    return wrapper
}

const SAMPLE: ProbePage = {
    items: [
        {
            seq: 2,
            at: new Date().toISOString(),
            source: 'local-edit',
            action: 'update',
            fields: [{ field: 'description', from: '旧描述', to: '新描述' }]
        },
        {
            seq: 1,
            at: new Date(Date.now() - 3_600_000).toISOString(),
            source: 'pull',
            action: 'update',
            fields: [{ field: 'priority', from: 'medium', to: 'high' }]
        }
    ],
    hasMore: false,
    unavailable: false
}

const INTERNAL_TOKENS = [
    'source',
    'action',
    'field',
    'seq',
    'plain:',
    'local-edit',
    'push-merge',
    'conflict-retry',
    'fieldBase',
    'revision',
    'syncedServerUpdatedAt'
]

describe('T706 / 面板真挂载：13 键中英齐备 + 可见文本无内部词 + 非表格式', () => {
    it('13 个 history.* 键在 zh / en 齐备、非空、键集一致（R-7 ≤13）', () => {
        const zh = messages['zh-CN'] as unknown as Record<string, string>
        const en = messages['en-US'] as unknown as Record<string, string>
        const keys = [
            'history.title',
            'history.empty',
            'history.loadFailed',
            'history.more',
            'history.source.local',
            'history.source.pull',
            'history.source.pushMerge',
            'history.source.conflictRetry',
            'history.action.create',
            'history.action.archive',
            'history.action.unarchive',
            'history.action.delete',
            'history.action.restore'
        ]
        for (const key of keys) {
            expect(zh[key], `zh-CN 缺 ${key}`).toBeTruthy()
            expect(en[key], `en-US 缺 ${key}`).toBeTruthy()
            expect(zh[key]).not.toBe(key)
        }
        const zhHistory = Object.keys(zh).filter((key) => key.startsWith('history.'))
        const enHistory = Object.keys(en).filter((key) => key.startsWith('history.'))
        expect(enHistory.sort()).toEqual(zhHistory.sort())
        expect(zhHistory.length).toBeLessThanOrEqual(13)
    })

    it('展开后：中文标题 / 字段标签 / 值 / 来源可读；可见文本无内部词；非表格式', async () => {
        const mounted = await mountPanel(SAMPLE)
        const text = mounted.text()

        expect(text).toContain(t('history.title'))
        expect(text).toContain(t('sync.conflict.field.description'))
        expect(text).toContain(t('sync.conflict.field.priority'))
        expect(text).toContain('旧描述')
        expect(text).toContain('新描述')
        expect(text).toContain(t('history.source.local'))
        expect(text).toContain(t('history.source.pull'))

        for (const token of INTERNAL_TOKENS) {
            expect(text, `可见文本不得出现内部词 ${token}`).not.toContain(token)
        }
        const html = mounted.html()
        expect(html).not.toContain('plain:')
        expect(html).not.toContain('<table')
        expect(html).not.toContain('nue-table')
    })

    it('unavailable（老库无历史）⇒「暂无变更记录」，且不显示「加载失败」', async () => {
        const mounted = await mountPanel({ items: [], hasMore: false, unavailable: true })
        const text = mounted.text()

        expect(text).toContain(t('history.title'))
        expect(text).toContain(t('history.empty'))
        expect(text).not.toContain(t('history.loadFailed'))
    })

    it('可用但 0 条 ⇒ 同样「暂无变更记录」，且不显示「加载失败」', async () => {
        const mounted = await mountPanel({ items: [], hasMore: false, unavailable: false })
        const text = mounted.text()

        expect(text).toContain(t('history.empty'))
        expect(text).not.toContain(t('history.loadFailed'))
    })

    it('有更早 ⇒ 显示「更早」入口；点击按最旧 seq 续页（keyset，不用 offset）', async () => {
        const load = vi.fn(async (_taskId: string, _beforeSeq?: number) => ({
            items: [
                {
                    seq: _beforeSeq === undefined ? 7 : 6,
                    at: new Date().toISOString(),
                    source: 'local-edit' as const,
                    action: 'update' as const,
                    fields: [{ field: 'name', from: 'a', to: 'b' }]
                }
            ],
            hasMore: _beforeSeq === undefined,
            unavailable: false
        }))
        const Host = defineComponent({
            components: { HistoryPanel },
            setup() {
                provide(TASK_DETAILS_CONTEXT_KEY, { vo: ref({ id: 'task-qa' }) } as never)
                provide(TASK_HISTORY_CONTEXT_KEY, { load } as never)
                return {}
            },
            template: '<history-panel />'
        })
        wrapper = mount(Host, { global: { components: NUE } })
        await flush()

        const more = wrapper
            .findAll('button')
            .find((node) => node.text().includes(t('history.more')))
        expect(more, 'hasMore 时必须给出「更早」入口').toBeTruthy()
        expect(load).toHaveBeenCalledTimes(1)
        expect(load.mock.calls[0]?.[1]).toBeUndefined()

        await more!.trigger('click')
        await flush()

        expect(load).toHaveBeenCalledTimes(2)
        expect(load.mock.calls[1]?.[1], '「更早」必须以最旧一条的 seq 作 keyset 游标').toBe(7)
        // 续页后不再声称「还有更早」
        expect(
            wrapper.findAll('button').some((node) => node.text().includes(t('history.more')))
        ).toBe(false)
    })
})