// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, provide, ref } from 'vue'
import { NueButton, NueDialog, NueDiv, NueEmpty, NueText } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
import { TASK_HISTORY_CONTEXT_KEY } from '../context'
import TaskHistoryDialog from '../task-history-dialog.vue'

/**
 * `T718 ④` · 无字段差异的条目**不得出现「展开」**（墓碑动作 `archive` / `delete` / `restore`
 * 按 PRD `AC7` 不带 `fields`）—— 原实现点开是空操作（死交互），本次收口。
 *
 * 判据（PM T718 ④ 要求「必须有断言兜住」）：
 * ① 无 `fields` ⇒ **不渲染** `.task-history__toggle`、**不置** `aria-expanded`（不是「置了但不生效」）；
 * ② 无 `fields` 的条目被点击 ⇒ 仍无 `.task-history__detail`、`aria-expanded` 仍不存在（无空操作反馈）；
 * ③ 外观/信息不变：徽标、右侧时间、主文案、`title` 全文提示一个不少；
 * ④ 有 `fields` 的条目行为不变（有展开、`aria-expanded` 随点击翻转）。
 *
 * ⚠️ 「行高不变」属布局量 ⇒ 证据在回执的 headless Chromium 探针（jsdom 无布局）。
 * @see docs/prds/2026-11-10-audit-log.md（AC7 · 墓碑操作不产生字段变更噪声）
 */

const NUE = {
    'nue-button': NueButton,
    'nue-dialog': NueDialog,
    'nue-div': NueDiv,
    'nue-empty': NueEmpty,
    'nue-text': NueText
}

const flush = async (): Promise<void> => {
    for (let index = 0; index < 8; index += 1) {
        await nextTick()
        await Promise.resolve()
    }
}

/** 带字段差异（可展开）+ 墓碑动作（`fields: []`，不可展开） */
const PAGE = {
    items: [
        {
            seq: 2,
            at: new Date().toISOString(),
            source: 'local-edit' as const,
            action: 'update' as const,
            fields: [{ field: 'description', from: '旧描述', to: '新描述' }]
        },
        {
            seq: 1,
            at: new Date(Date.now() - 60_000).toISOString(),
            source: 'local-edit' as const,
            action: 'archive' as const,
            fields: []
        }
    ],
    hasMore: false,
    unavailable: false
}

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

const mountDialog = async (): Promise<HTMLButtonElement[]> => {
    const Host = defineComponent({
        components: { TaskHistoryDialog },
        setup() {
            provide(TASK_HISTORY_CONTEXT_KEY, {
                load: vi.fn(async () => PAGE)
            } as never)
            const visible = ref(true)
            return { visible }
        },
        template: `<task-history-dialog v-model="visible" task-id="task-t718" />`
    })
    wrapper = mount(Host, { attachTo: document.body, global: { components: NUE } })
    await flush()
    const dialog = document.body.querySelector<HTMLElement>('.nue-dialog--task-history')
    expect(dialog, '对话框必须真挂载').toBeTruthy()
    return Array.from(dialog!.querySelectorAll<HTMLButtonElement>('button.task-history__entry'))
}

describe('T718 ④ / 无字段差异的条目不得有「展开」死交互', () => {
    it('无 fields ⇒ 不渲染展开、不置 aria-expanded；点击也无 detail（不是「置了不生效」）', async () => {
        const rows = await mountDialog()
        expect(rows.length, '夹具自检：一条可展开 + 一条墓碑动作').toBe(2)

        const tombstone = rows[1]!
        expect(tombstone.textContent, '自检：这是一条归档记录').toContain(
            t('history.action.archive')
        )
        expect(
            tombstone.querySelector('.task-history__toggle'),
            '无 fields ⛔ 不得显示「展开」'
        ).toBe(null)
        expect(
            tombstone.getAttribute('aria-expanded'),
            '无 fields ⇒ 连 aria-expanded 都不该出现（否则读屏会宣告可展开）'
        ).toBe(null)

        // 外观/信息不变：徽标 + 时间 + 主文案 + title 全文提示
        expect(tombstone.querySelector('.task-history__badge')).toBeTruthy()
        expect((tombstone.querySelector('time')?.textContent ?? '').trim()).not.toBe('')
        const summaryText = (
            tombstone.querySelector('.task-history__summary')?.textContent ?? ''
        ).trim()
        expect(summaryText).toContain(t('history.source.local'))
        expect(tombstone.getAttribute('title')).toBe(summaryText)

        // 点击（含徽标位置）⇒ 无 detail、无 aria-expanded、无展开文案
        tombstone
            .querySelector('.task-history__badge')!
            .dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flush()
        expect(tombstone.querySelector('.task-history__detail'), '不得出现空的展开区').toBe(null)
        expect(tombstone.getAttribute('aria-expanded')).toBe(null)
        expect(tombstone.textContent).not.toContain(t('sync.conflict.collapse'))
    })

    it('有 fields ⇒ 行为不变：显示展开、aria-expanded 随点击翻转', async () => {
        const rows = await mountDialog()
        const expandable = rows[0]!

        const toggle = expandable.querySelector('.task-history__toggle')
        expect(toggle, '有 fields ⇒ 必须有展开入口').toBeTruthy()
        expect(toggle!.textContent?.trim()).toBe(t('sync.conflict.expand'))
        expect(expandable.getAttribute('aria-expanded')).toBe('false')

        expandable.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flush()
        expect(expandable.getAttribute('aria-expanded')).toBe('true')
        expect(expandable.querySelector('.task-history__detail')).toBeTruthy()
        expect(expandable.querySelector('.task-history__toggle')!.textContent?.trim()).toBe(
            t('sync.conflict.collapse')
        )

        expandable.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flush()
        expect(expandable.getAttribute('aria-expanded')).toBe('false')
        expect(expandable.querySelector('.task-history__detail')).toBe(null)
    })
})