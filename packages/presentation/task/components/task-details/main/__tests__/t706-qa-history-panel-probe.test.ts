// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, provide, ref } from 'vue'
import { NueButton, NueDialog, NueDiv, NueEmpty, NueText } from 'nue-ui'
import { messages, t } from '@nao-todo/shared/locales'
import { TASK_HISTORY_CONTEXT_KEY } from '../../context'
import TaskHistoryDialog from '../../task-history-dialog.vue'

/**
 * T706 · 面板**真挂载**复核（QA 自写探针；⛔ 不 stub 被测组件，只注入 provider）
 *
 * **载体变更（`T713`，`R-10` / `AC12` / `D8`）**：内联面板 `main/history.vue` 已迁为
 * `task-history-dialog.vue`（对话框 + `props`）。本文件只改**import 与挂载方式**：
 * 直接真挂载对话框组件（`modelValue: true` + `taskId`），断言其传送至 `document.body` 的内容；
 * **全部内容类断言逐字保留**（详见各用例）。
 *
 * 独立于 `t697-ac3` 的复核点（PM T706 #5）：
 * ① 13 个 `history.*` 键**中英齐备**（值非空、同键集）；
 * ② **可见文本**无内部词：`source` / `action` / `field` / `seq` / `plain:` / `local-edit` /
 *    `push-merge` / `conflict-retry` / `fieldBase` / `revision`（注意：类名含 `__source` 等属实现细节，
 *    判据是**用户可见文本**，故用 `textContent` 而非 `innerHTML`；`plain:` 额外在 `innerHTML` 上也判一次）；
 * ③ 非表格式：无 `<table>` / `nue-table`；
 * ④ `unavailable` 与「可用但 0 条」**都**显示「暂无变更记录」，且**都不**显示「加载失败」；
 * ⑤ 来源 / 动作 / 字段一律中文（复用字段标签 + 13 键）。
 */

const NUE = {
    'nue-button': NueButton,
    'nue-dialog': NueDialog,
    'nue-div': NueDiv,
    'nue-empty': NueEmpty,
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

/**
 * 真挂载对话框（`NueDialog` 传送至 body ⇒ 返回对话框根元素，后续断言以它为准）
 * @param page 固定页（或自定义 `load`，见「更早」用例）
 */
const mountPanel = async (
    page: ProbePage | ((taskId: string, beforeSeq?: number) => Promise<ProbePage>)
): Promise<HTMLElement> => {
    const load =
        typeof page === 'function'
            ? vi.fn(page)
            : vi.fn(async (_taskId: string, _beforeSeq?: number) => page)
    const Host = defineComponent({
        components: { TaskHistoryDialog },
        setup() {
            provide(TASK_HISTORY_CONTEXT_KEY, { load } as never)
            const visible = ref(true)
            return { visible, load }
        },
        template: `<task-history-dialog v-model="visible" task-id="task-qa" />`
    })
    wrapper = mount(Host, { attachTo: document.body, global: { components: NUE } })
    await flush()
    const dialog = document.body.querySelector<HTMLElement>('.nue-dialog--task-history')
    expect(dialog, '对话框必须真挂载（⛔ 不 stub 被测组件）').toBeTruthy()
    return dialog!
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
    it('13 个 history.* 键在 zh / en 齐备、非空、键集一致（R-7 ≤16）', () => {
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
        // `D9` 按天分组 ⇒ R-7 预算 13 → 16（组标题 3 个专用键）；键集一致性仍逐字保留
        expect(zhHistory.length).toBeLessThanOrEqual(16)
    })

    it('打开后：中文标题 / 字段标签 / 值 / 来源可读；可见文本无内部词；非表格式', async () => {
        const dialog = await mountPanel(SAMPLE)
        const text = dialog.textContent ?? ''

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
        const html = dialog.innerHTML
        expect(html).not.toContain('plain:')
        expect(html).not.toContain('<table')
        expect(html).not.toContain('nue-table')
    })

    it('unavailable（老库无历史）⇒「暂无变更记录」，且不显示「加载失败」', async () => {
        const dialog = await mountPanel({ items: [], hasMore: false, unavailable: true })
        const text = dialog.textContent ?? ''

        expect(text).toContain(t('history.title'))
        expect(text).toContain(t('history.empty'))
        expect(text).not.toContain(t('history.loadFailed'))
    })

    it('可用但 0 条 ⇒ 同样「暂无变更记录」，且不显示「加载失败」', async () => {
        const dialog = await mountPanel({ items: [], hasMore: false, unavailable: false })
        const text = dialog.textContent ?? ''

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
        let dialog = await mountPanel(load)

        const moreButtons = (): HTMLButtonElement[] =>
            Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
        const more = moreButtons().find((node) =>
            (node.textContent ?? '').includes(t('history.more'))
        )
        expect(more, 'hasMore 时必须给出「更早」入口').toBeTruthy()
        expect(load).toHaveBeenCalledTimes(1)
        expect(load.mock.calls[0]?.[1]).toBeUndefined()

        more!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flush()
        dialog = document.body.querySelector<HTMLElement>('.nue-dialog--task-history')!

        expect(load).toHaveBeenCalledTimes(2)
        expect(load.mock.calls[1]?.[1], '「更早」必须以最旧一条的 seq 作 keyset 游标').toBe(7)
        // 续页后不再声称「还有更早」
        expect(
            moreButtons().some((node) => (node.textContent ?? '').includes(t('history.more')))
        ).toBe(false)
    })
})