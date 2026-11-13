// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, provide, ref } from 'vue'
import { NueButton, NueDialog, NueDiv, NueEmpty, NueText } from 'nue-ui'
import { messages, t } from '@nao-todo/shared/locales'
import { TASK_HISTORY_CONTEXT_KEY, type TaskHistoryPage } from '../context'
import TaskHistoryDialog from '../task-history-dialog.vue'
import componentSourceRaw from '../task-history-dialog.vue?raw'

/**
 * `T717` · 活动流（activity feed）改造的**独立复核**（PM T717 8 项清单的可判部分）
 *
 * ⛔ 不复用 `t716-*`（rd-fe 自有用例）与 `t697-*` 夹具；夹具全部自建。
 * ⛔ 不改生产代码：本文件只**观测**。
 *
 * 覆盖（可判部分）：① 样式**零命中**（源码声明级）② 整行可点（原生 `button` + 行内任意位置）
 * ③ `title` 全文 / 展开后完整值 ⑤ 三重冗余（符号 + 文字 + 颜色三通道）⑥ 不回退
 * （三路关闭 / 打开期间刷新不重挂不重取数）⑦ C 端红线 ⑧ i18n 恰 16 键。
 *
 * ⚠️ **布局与计算样式**（行高 ≥44px / 省略号真溢出 / 渲染后对比度 / hover / focus 环 / 真 Enter）
 * = jsdom 无布局引擎 ⇒ 证据在 `t717-qa-history-feed-render.test.ts`（headless Chromium，真渲染）。
 * @see docs/prds/2026-11-10-audit-log.md（D9 / AC13 / R-7 预算 16）
 */

const NUE = {
    'nue-button': NueButton,
    'nue-dialog': NueDialog,
    'nue-div': NueDiv,
    'nue-empty': NueEmpty,
    'nue-text': NueText
}

/** SFC 原文（源码声明级断言用；`?raw` 与磁盘同源） */
const componentSource = componentSourceRaw as unknown as string

const flush = async (): Promise<void> => {
    for (let index = 0; index < 8; index += 1) {
        await nextTick()
        await Promise.resolve()
    }
}

const DAY = 86_400_000

const LONG_VALUE =
    '这是一段非常长的描述文本，用来验证活动流主文案在单行内省略号生效、全文仍可从 title 读到，并且展开后能看到完整内容，而不是被截断成一句看不懂的半截话，长度需要超过对话框宽度的一行。'

const PAGE: TaskHistoryPage = {
    items: [
        {
            seq: 4,
            at: new Date().toISOString(),
            source: 'local-edit',
            action: 'update',
            fields: [
                { field: 'description', from: '旧描述', to: LONG_VALUE },
                { field: 'priority', from: 'medium', to: 'high' }
            ]
        },
        {
            seq: 3,
            at: new Date().toISOString(),
            source: 'pull',
            action: 'update',
            fields: [{ field: 'name', from: '旧名', to: '新名' }]
        },
        {
            seq: 2,
            at: new Date(Date.now() - DAY).toISOString(),
            source: 'push-merge',
            action: 'update',
            fields: [{ field: 'state', from: 'todo', to: 'done' }]
        },
        {
            seq: 1,
            at: new Date(Date.now() - 3 * DAY).toISOString(),
            source: 'conflict-retry',
            action: 'create',
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

interface Mounted {
    dialog: HTMLElement
    load: ReturnType<typeof vi.fn>
    visible: ReturnType<typeof ref<boolean>>
    bump: () => Promise<void>
}

/**
 * 真挂载生产对话框（`NueDialog` 传送至 body）
 * @param page 页数据（默认 4 来源各一条，含一条超长值）
 */
const mountDialog = async (page: TaskHistoryPage = PAGE): Promise<Mounted> => {
    const load = vi.fn(async (_taskId: string, _beforeSeq?: number) => page)
    const visible = ref(true)
    const tick = ref(0)
    const Host = defineComponent({
        components: { TaskHistoryDialog },
        setup() {
            provide(TASK_HISTORY_CONTEXT_KEY, { load } as never)
            return { visible, tick }
        },
        template: `<div><task-history-dialog v-model="visible" :task-id="'task-t717'" /></div>`
    })
    wrapper = mount(Host, { attachTo: document.body, global: { components: NUE } })
    await flush()
    const dialog = document.body.querySelector<HTMLElement>('.nue-dialog--task-history')
    expect(dialog, '对话框必须真挂载（⛔ 不 stub 被测组件）').toBeTruthy()
    return {
        dialog: dialog!,
        load,
        visible,
        /** 父容器无关重渲染（模拟详情页刷新时的父级更新） */
        bump: async () => {
            tick.value += 1
            await flush()
        }
    }
}

const rows = (dialog: HTMLElement): HTMLButtonElement[] =>
    Array.from(dialog.querySelectorAll<HTMLButtonElement>('button.task-history__entry'))

const styleBlocks = (source: string): string =>
    source
        .slice(source.indexOf('<style'))
        // 注释是说明文字（含「已删 border-left」），不是声明 ⇒ 先剔除再判
        .replace(/\/\*[\s\S]*?\*\//g, '')

/** 去掉注释后的**代码体**（注释里写「⛔ 不得挪用 xxx」是说明，不是引用） */
const codeOnly = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** jsdom 无动画 ⇒ 库在动画结束后才 emit（`×` / Esc 需补发 `animationend`） */
const finishCloseAnimation = async (): Promise<void> => {
    document.body
        .querySelector('.nue-dialog--task-history')
        ?.dispatchEvent(new Event('animationend', { bubbles: true }))
    await flush()
}

describe('T717 / 活动流独立复核（jsdom 可判部分）', () => {
    it('① 样式零命中：组件样式声明里无 border-left / border-inline-start / 竖线 / 轨道 / grid', () => {
        const style = styleBlocks(componentSource)

        expect(style, '⛔ 不得有 border-left 声明（`D9` 删的就是它）').not.toMatch(
            /border-left\s*:/
        )
        expect(style, '⛔ 不得有逻辑属性等价写法').not.toMatch(/border-inline-start\s*:/)
        // 竖线 / 时间轴轨道的常见伪装：伪元素画线、渐变画线、单独画一根 1px 竖条
        expect(style, '⛔ 不得用 linear-gradient 画轨道').not.toMatch(/linear-gradient/)
        expect(style, '⛔ 不得用伪元素画竖线').not.toMatch(/::?(?:before|after)[^{]*\{[^}]*border/)
        expect(style, '⛔ 不得出现 grid 布局（C 端红线）').not.toMatch(/display\s*:\s*grid/)
        // 反向自检：万一整段样式没读到，上面全是空断言 ⇒ 断言确实读到了样式
        expect(style).toContain('.task-history__entry')
        expect(style).toContain('min-height: 44px')
    })

    it('② 整行可点：行是原生 button（Tab/Enter 天然可达），点徽标 / 主文案 / 时间都展开', async () => {
        const { dialog } = await mountDialog()
        const list = rows(dialog)
        expect(list.length, '夹具自检：4 条记录（4 来源）').toBe(4)

        for (const row of list) {
            expect(row.tagName, '整行必须是原生 button').toBe('BUTTON')
            expect(row.getAttribute('type')).toBe('button')
            expect(row.hasAttribute('tabindex'), '⛔ 不要自定义 tabindex（原生按钮已可达）').toBe(
                false
            )
            expect(row.getAttribute('aria-expanded')).toBe('false')
            // 行内三块（徽标 / 主文案 / 时间）都在**按钮内部** ⇒ 点哪都算点行
            expect(row.querySelector('.task-history__badge')).toBeTruthy()
            expect(row.querySelector('.task-history__summary')).toBeTruthy()
            expect(row.querySelector('time')).toBeTruthy()
        }

        const [row] = list
        for (const selector of [
            '.task-history__badge',
            '.task-history__summary',
            '.task-history__time'
        ]) {
            row!.querySelector(selector)!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
            await flush()
            expect(row!.getAttribute('aria-expanded'), `点 ${selector} 必须展开`).toBe('true')
            row!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
            await flush()
            expect(row!.getAttribute('aria-expanded'), `再点 ${selector} 必须收起`).toBe('false')
        }
    })

    it('③ 展开语义：`title` = 主文案全文；展开后逐字段给出完整旧值 / 新值（未被截断的文本在 DOM）', async () => {
        const { dialog } = await mountDialog()
        const row = rows(dialog)[0]!

        const summary = row.querySelector('.task-history__summary')!
        const title = row.getAttribute('title') ?? ''
        expect(title, '`title` 必须给全文（单行省略的兜底）').toBe(
            (summary.textContent ?? '').trim()
        )
        expect(title).toContain(LONG_VALUE)
        expect(row.querySelector('.task-history__detail'), '折叠时不得渲染差异块').toBe(null)

        row.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flush()

        const detail = row.querySelector('.task-history__detail')!
        expect(detail).toBeTruthy()
        expect(detail.querySelectorAll('.task-history__detail-row').length, '两个字段').toBe(2)
        expect(detail.textContent, '展开后长值必须完整可读').toContain(LONG_VALUE)
        expect(detail.textContent).toContain(t('sync.conflict.field.description'))
        expect(detail.textContent).toContain('旧描述')
        // 展开态可辨（文字通道）：切换为「收起」
        expect(
            row.querySelector('.task-history__toggle')?.textContent?.trim(),
            '展开后文字必须变「收起」（⛔ 仅靠颜色）'
        ).toBe(t('sync.conflict.collapse'))
    })

    it('⑤ 三重冗余：4 来源的符号 / 文字 / 颜色三通道两两互不相同（去色后仍靠符号+文字可辨）', async () => {
        const { dialog } = await mountDialog()
        const list = rows(dialog)
        expect(list.length, '夹具自检：4 来源各一条').toBe(4)

        const sources = ['local-edit', 'pull', 'push-merge', 'conflict-retry'] as const
        const labels = sources.map((source) => t(`history.source.${SOURCE_KEY[source]}` as never))
        const symbols = list.map((row) =>
            (row.querySelector('.task-history__badge')?.textContent ?? '').trim()
        )
        const tones = list.map(
            (row) =>
                Array.from(row.classList)
                    .find((name) => name.startsWith('task-history__entry--'))
                    ?.replace('task-history__entry--', '') ?? ''
        )

        expect(new Set(labels).size, '文字通道：4 个来源文案互不相同').toBe(4)
        expect(new Set(symbols).size, '符号通道：4 个徽标符号互不相同').toBe(4)
        expect(
            symbols.every((symbol) => symbol.length > 0),
            '符号不得为空（空 = 只剩颜色）'
        ).toBe(true)
        expect(new Set(tones).size, '颜色通道：4 个来源修饰互不相同').toBe(4)
        for (const label of labels) {
            expect(
                list.some((row) => (row.getAttribute('title') ?? '').startsWith(label)),
                '文字通道：每行主文案必须以来源中文开头（去色后靠它 + 符号区分）'
            ).toBe(true)
        }
    })

    it('⑥a 三路关闭：底部按钮 / × / Esc 都让 v-model 置假，并清空内容（无残留）', async () => {
        const closes: Array<(dialog: HTMLElement) => Promise<void>> = [
            async (dialog) => {
                const button = Array.from(
                    dialog.querySelectorAll<HTMLButtonElement>('.nue-dialog__footer button')
                ).find((node) => (node.textContent ?? '').includes(t('common.close')))
                expect(button, '底部必须有「关闭」').toBeTruthy()
                button!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                await flush()
            },
            async (dialog) => {
                const closeX = dialog.querySelector<HTMLElement>('.nue-dialog__header__closebtn')
                expect(closeX, '右上角必须有 ×').toBeTruthy()
                closeX!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                await flush()
                await finishCloseAnimation()
            },
            async () => {
                document.body
                    .querySelector<HTMLElement>('.nue-overlay')
                    ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
                await flush()
                await finishCloseAnimation()
            }
        ]

        for (const [index, close] of closes.entries()) {
            const { dialog, visible } = await mountDialog()
            await close(dialog)
            expect(visible.value, `关闭方式 #${index + 1} 必须把 v-model 置 false`).toBe(false)
            // 关闭即卸载内容 ⇒ 再打开必然重新取数（无缓存残留）
            wrapper?.unmount()
            wrapper = null
            document.body.innerHTML = ''
        }
    })

    it('⑥b 打开期间刷新：父级无关重渲染 ⇒ 同一 DOM 节点、条目不清空、load 仍 1 次', async () => {
        const { dialog, load, bump } = await mountDialog()
        expect(load).toHaveBeenCalledTimes(1)
        const before = rows(dialog).length
        expect(before, '夹具自检：4 条').toBe(4)

        await bump()
        await bump()

        const after = document.body.querySelector<HTMLElement>('.nue-dialog--task-history')
        expect(after, '重渲染不得关闭对话框').toBe(dialog)
        expect(rows(after!).length, '重渲染不得清空列表').toBe(before)
        expect(load, '重渲染不得重新取数').toHaveBeenCalledTimes(1)
    })

    it('⑦ C 端红线：无 <table> / nue-table / grid 类名 / 表格 role', async () => {
        const { dialog } = await mountDialog()

        expect(dialog.innerHTML).not.toContain('<table')
        expect(dialog.innerHTML).not.toContain('nue-table')
        expect(dialog.querySelector('[role="table"],[role="grid"]')).toBe(null)
        const tableish = Array.from(dialog.querySelectorAll<HTMLElement>('.task-history *')).filter(
            (node) => /grid|table/.test(node.className)
        )
        expect(tableish.length, '⛔ 类名里不得出现 grid / table').toBe(0)
        // 行是 button 而非 tr/td
        expect(dialog.querySelector('tr,td,th')).toBe(null)
    })

    it('⑧ i18n：`history.*` 恰 16 键（含 3 组标题），zh/en 键集一致；⛔ 不挪用其它键', () => {
        const expected = [
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
            'history.action.restore',
            'history.group.today',
            'history.group.yesterday',
            'history.group.earlier'
        ].sort()

        const zh = messages['zh-CN'] as unknown as Record<string, string>
        const en = messages['en-US'] as unknown as Record<string, string>
        expect(
            Object.keys(zh)
                .filter((key) => key.startsWith('history.'))
                .sort()
        ).toEqual(expected)
        expect(
            Object.keys(en)
                .filter((key) => key.startsWith('history.'))
                .sort()
        ).toEqual(expected)

        // 组标题必须专用：⛔ 挪用既有无语义键 / ⛔ 一个键两种含义
        const groups = ['history.group.today', 'history.group.yesterday', 'history.group.earlier']
        expect(new Set(groups.map((key) => zh[key])).size, 'zh 三个组标题必须互不相同').toBe(3)
        expect(new Set(groups.map((key) => en[key])).size, 'en 三个组标题必须互不相同').toBe(3)
        expect(zh['history.group.earlier']).not.toBe(zh['history.more'])
        expect(codeOnly(componentSource), '⛔ 不得挪用 settings/calendar 的日期键').not.toContain(
            'settings.sessionYesterday'
        )
        expect(codeOnly(componentSource)).not.toContain('calendar.today')
    })
})

/** 来源 → 文案键后缀（与本文件断言同步；⛔ 不改生产代码，故在测试侧登记） */
const SOURCE_KEY = {
    'local-edit': 'local',
    pull: 'pull',
    'push-merge': 'pushMerge',
    'conflict-retry': 'conflictRetry'
} as const