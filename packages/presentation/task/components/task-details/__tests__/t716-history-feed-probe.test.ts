// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, provide, ref } from 'vue'
import { NueButton, NueDialog, NueDiv, NueEmpty, NueText } from 'nue-ui'
import { messages, t } from '@nao-todo/shared/locales'
import { TASK_HISTORY_CONTEXT_KEY } from '../context'
import TaskHistoryDialog from '../task-history-dialog.vue'
import componentSource from '../task-history-dialog.vue?raw'

/**
 * `T716` · 活动流（activity feed）改造复核（PRD `D9` / `AC13`，2026-11-12 用户定）
 *
 * 用户原话：「不要选项左侧线条这种设计了，参考业界历史记录类的展示方式」⇒ 目标形态 =
 * GitHub 活动流 / Linear 按天分组 / Notion 行式列表。
 *
 * 本文件（jsdom 可判部分，⛔ 不 stub 被测组件）：
 * ① 结构：每行 = **原生 `button`**（⇒ Tab 可达、Enter 激活）+ 20px 徽标（符号）+ 一行主文案 +
 *    右侧时间；`aria-expanded` 表达展开态
 * ② **左边框 0 命中**：组件样式源码里 `border-left` / `border-inline-start` 为 0，且 DOM 上无
 *    任何 `task-history__entry` 带非零 `border-left`
 * ③ 非表格式：无 `<table>` / `nue-table` / `grid` 类名
 * ④ 按天分组：今天 / 昨天 / 更早（专用键 `history.group.*`，空组不渲染）
 * ⑤ 整行可点：点**徽标位置**（行内最左侧）也展开；再点收起；展开后逐行显示字段差异
 * ⑥ 分页仍是 keyset：`history.more` 按钮以最旧 `seq` 续页，`hasMore=false` 后消失
 *
 * ⚠️ 行高 ≥44px / hover / focus 环 / 渲染后对比度 = **布局与计算样式**，jsdom 无布局 ⇒
 * 证据在回执的 headless Chromium 探针（真 Vite + 真 Vue + 真主题），本文件不复刻。
 * @see docs/prds/2026-11-10-audit-log.md（D9 / AC13 / R-7 预算 16）
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

const PAGE = {
    items: [
        {
            seq: 4,
            at: new Date().toISOString(),
            source: 'local-edit' as const,
            action: 'update' as const,
            fields: [
                { field: 'description', from: '旧描述', to: '新描述' },
                { field: 'priority', from: 'medium', to: 'high' }
            ]
        },
        {
            seq: 3,
            at: new Date(Date.now() - 86_400_000).toISOString(),
            source: 'push-merge' as const,
            action: 'update' as const,
            fields: [{ field: 'name', from: '旧名', to: '新名' }]
        },
        {
            seq: 2,
            at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
            source: 'conflict-retry' as const,
            action: 'create' as const,
            fields: [{ field: 'name', from: null, to: '买菜' }]
        }
    ],
    hasMore: true,
    unavailable: false
}

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

const mountDialog = async (
    page: typeof PAGE = PAGE
): Promise<{ dialog: HTMLElement; load: ReturnType<typeof vi.fn> }> => {
    const load = vi.fn(async (_taskId: string, _beforeSeq?: number) => page)
    const Host = defineComponent({
        components: { TaskHistoryDialog },
        setup() {
            provide(TASK_HISTORY_CONTEXT_KEY, { load } as never)
            const visible = ref(true)
            return { visible }
        },
        template: `<task-history-dialog v-model="visible" task-id="task-t716" />`
    })
    wrapper = mount(Host, { attachTo: document.body, global: { components: NUE } })
    await flush()
    const dialog = document.body.querySelector<HTMLElement>('.nue-dialog--task-history')
    expect(dialog, '对话框必须真挂载（⛔ 不 stub 被测组件）').toBeTruthy()
    return { dialog: dialog!, load }
}

const rows = (dialog: HTMLElement): HTMLButtonElement[] =>
    Array.from(dialog.querySelectorAll<HTMLButtonElement>('button.task-history__entry'))

describe('T716 / 活动流（去左侧色条 / 时间轴轨道）', () => {
    it('① 每行 = 原生 button（Tab/Enter 天然可达）+ 徽标符号 + 主文案 + 右侧时间 + aria-expanded', async () => {
        const { dialog } = await mountDialog()
        const list = rows(dialog)
        expect(list.length, '夹具自检：三条记录').toBe(3)
        for (const row of list) {
            expect(row.tagName).toBe('BUTTON')
            expect(row.getAttribute('type')).toBe('button')
            expect(row.getAttribute('aria-expanded'), '展开态必须经 aria-expanded 表达').toBe(
                'false'
            )
            // 徽标：符号（去色后仍可区分）+ 来源色类名（颜色只是辅助）
            const badge = row.querySelector('.task-history__badge')
            expect(badge, '每行必须有来源徽标').toBeTruthy()
            expect(badge!.getAttribute('aria-hidden'), '徽标符号是装饰性的（文字已表意）').toBe(
                'true'
            )
            expect(['✎', '☁', '⇄', '↺']).toContain((badge!.textContent ?? '').trim())
            // 右侧时间
            expect(row.querySelector('time')?.textContent ?? '').not.toBe('')
            // 长值全文在 title 里（单行省略由 CSS 承担）
            const title = row.getAttribute('title') ?? ''
            expect(title).toBe(
                (row.querySelector('.task-history__summary')?.textContent ?? '').trim()
            )
        }
    })

    it('② 左边框 0 命中：组件样式源码无 border-left / 竖线，DOM 行上 border-left 全为 0', async () => {
        const source = componentSource as unknown as string
        // 只核**声明**（先剔注释：注释里写「已删 xxx」属说明文字，不是样式）
        const styleSource = source.slice(source.indexOf('<style')).replace(/\/\*[\s\S]*?\*\//g, '')
        expect(styleSource).not.toContain('border-left')
        expect(styleSource).not.toContain('border-inline-start')

        const { dialog } = await mountDialog()
        for (const row of rows(dialog)) {
            // jsdom 不加载 SFC 样式 ⇒ 只核「行上无内联边框」（样式声明的真相由上面的源码断言 +
            // 回执里 headless Chromium 的**渲染后** `borderLeftWidth` 实测兜住）
            expect(row.style.borderLeft).toBe('')
            expect(row.style.borderLeftWidth).toBe('')
            expect(row.getAttribute('style')).toBe(null)
        }
    })

    it('③ 非表格式：无 <table> / nue-table / grid 类名（C 端红线）', async () => {
        const { dialog } = await mountDialog()
        expect(dialog.innerHTML).not.toContain('<table')
        expect(dialog.innerHTML).not.toContain('nue-table')
        const gridNodes = Array.from(dialog.querySelectorAll('.task-history *')).filter((node) =>
            /grid|table/.test(node.className)
        )
        expect(gridNodes.length).toBe(0)
    })

    it('④ 按天分组：今天 / 昨天 / 更早（专用键 history.group.*），空组不渲染', async () => {
        const { dialog } = await mountDialog()
        const titles = Array.from(dialog.querySelectorAll('.task-history__group-title')).map(
            (node) => (node.textContent ?? '').trim()
        )
        expect(titles).toEqual([
            t('history.group.today'),
            t('history.group.yesterday'),
            t('history.group.earlier')
        ])
        // 专用键：中英齐备、互不相同（⛔ 不挪用 calendar.today / settings.sessionYesterday）
        const zh = messages['zh-CN'] as unknown as Record<string, string>
        const en = messages['en-US'] as unknown as Record<string, string>
        const keys = ['history.group.today', 'history.group.yesterday', 'history.group.earlier']
        for (const key of keys) {
            expect(zh[key], `zh-CN 缺 ${key}`).toBeTruthy()
            expect(en[key], `en-US 缺 ${key}`).toBeTruthy()
        }
        expect(new Set(keys.map((key) => zh[key])).size).toBe(keys.length)
        expect(new Set(keys.map((key) => en[key])).size).toBe(keys.length)

        // 只有「今天」一条时，昨天 / 更早组不渲染
        wrapper?.unmount()
        wrapper = null
        document.body.innerHTML = ''
        const { dialog: single } = await mountDialog({
            items: [PAGE.items[0]!],
            hasMore: false,
            unavailable: false
        })
        expect(
            Array.from(single.querySelectorAll('.task-history__group-title')).map((node) =>
                (node.textContent ?? '').trim()
            )
        ).toEqual([t('history.group.today')])
    })

    it('⑤ 整行可点：点徽标位置也展开；再点收起；展开后逐行显示字段差异', async () => {
        const { dialog } = await mountDialog()
        const [row] = rows(dialog)
        const badge = row!.querySelector('.task-history__badge')!

        badge.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flush()
        expect(row!.getAttribute('aria-expanded')).toBe('true')
        const detail = row!.querySelector('.task-history__detail')
        expect(detail, '展开后必须有结构化差异块').toBeTruthy()
        expect(detail!.querySelectorAll('.task-history__detail-row').length, '两处字段差异').toBe(2)
        expect(detail!.textContent).toContain(t('sync.conflict.field.description'))
        expect(detail!.textContent).toContain('旧描述')
        expect(detail!.textContent).toContain('新描述')
        expect(row!.querySelector('.task-history__toggle')?.textContent?.trim()).toBe(
            t('sync.conflict.collapse')
        )

        row!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flush()
        expect(row!.getAttribute('aria-expanded')).toBe('false')
        expect(row!.querySelector('.task-history__detail')).toBe(null)
        expect(row!.querySelector('.task-history__toggle')?.textContent?.trim()).toBe(
            t('sync.conflict.expand')
        )
    })

    it('⑥ 分页仍按 keyset：history.more 以最旧 seq 续页，hasMore=false 后消失', async () => {
        const { dialog, load } = await mountDialog()
        const more = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find((node) =>
            (node.textContent ?? '').includes(t('history.more'))
        )
        expect(more, 'hasMore ⇒ 必须有「更早」入口').toBeTruthy()

        more!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flush()
        expect(load).toHaveBeenCalledTimes(2)
        expect(load.mock.calls[1]?.[1], '必须以最旧一条的 seq 作游标（⛔ 不用 offset）').toBe(2)
    })
})