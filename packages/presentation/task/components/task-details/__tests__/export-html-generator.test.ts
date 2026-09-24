import { describe, expect, it } from 'vite-plus/test'
import { generateTaskHtml } from '../export-html'
import type { ExportTaskNode } from '../export-markdown'

/**
 * TASK-22 T94 —— HTML 账单单据渲染器纯函数断言（PRD §5.4 + §14 / AC3 / AC4）
 * @description 契约（PRD §5.4 / §14）：
 *  - 签名 `generateTaskHtml(root, labels, generatedAt) -> string`；纯函数，无 Vue / i18n / I/O；
 *  - 输出**完整 HTML 文档**（`<!DOCTYPE html>` + `<head>` + `<style>` + `<body>`）；
 *  - **自包含**：无外部资源（禁 `src=` / `href=` / `@import` / `url(` 外链）、无脚本；
 *  - **固定浅色**：`<meta name="color-scheme" content="light">` + `color-scheme: light`；
 *  - 五字符转义（`&` `<` `>` `"` `'`）覆盖全部插值文本；
 *  - 描述保留换行（`white-space: pre-wrap`）；
 *  - 空段整段省略（检查项 / 子任务 / 说明）；合计段（检查项 x/y、子任务 x/y）独有，
 *    `y === 0` 的组整行省略，两组皆无 ⇒ 整段省略；
 *  - 递归深度上限 `MAX_EXPORT_DEPTH = 5`；`html lang` 随 locale；
 *  - `generatedAt` 由调用方注入 ⇒ 可确定性断言。
 *
 * ⚠️ 用例先行：`../export-html` 与新增类型字段属 T95，未落地 ⇒ 当前预期红（契约未实现）。
 *    本文件同时钉死 labels 形状（见 `htmlLabels`）作为 T94 契约，若 T95 采用不同键名需回 PM 对齐。
 */

const GENERATED_AT = '2026-09-23 10:30'

/** HTML 渲染器注入文案（T94 钉死的契约形状；值取 zh-CN） */
const htmlLabels = {
    lang: 'zh-CN',
    total: '合计',
    checkItems: '检查项',
    subTasks: '子任务',
    state: '状态',
    priority: '优先级',
    startAt: '开始',
    endAt: '截止',
    project: '项目',
    tags: '标签',
    createdAt: '创建',
    updatedAt: '更新',
    description: '说明',
    issuedAt: '开具于',
    documentNo: '单据号',
    generatedBy: '本单据由 nao-todo 生成于'
}

const makeNode = (overrides: Partial<ExportTaskNode> = {}): ExportTaskNode => ({
    id: 'node-1',
    name: '任务',
    state: 'todo',
    stateLabel: '待办',
    priority: 'low',
    priorityLabel: '低',
    isGivenUp: false,
    startAt: null,
    endAt: null,
    projectId: null,
    projectName: '',
    tagIds: [],
    tagNames: [],
    createdAt: '2026-09-19T02:00:00.000Z',
    updatedAt: '2026-09-19T03:00:00.000Z',
    description: '',
    checkItems: [],
    children: [],
    ...overrides
})

const render = (root: ExportTaskNode): string =>
    generateTaskHtml(root, htmlLabels as never, GENERATED_AT)

describe('generateTaskHtml - 完整文档与固定浅色（§5.4 / AC3）', () => {
    it('输出完整 HTML 文档骨架（DOCTYPE/head/style/body/html lang）', () => {
        const out = render(makeNode({ name: '单据' }))

        expect(out).toMatch(/^<!DOCTYPE html>/i)
        expect(out).toMatch(/<\/html>\s*$/i)
        expect(out).toContain('<html lang="zh-CN">')
        expect(out).toContain('<head>')
        expect(out).toContain('<style>')
        expect(out).toContain('<body>')
    })

    it('固定浅色：meta color-scheme + CSS color-scheme: light（不跟随暗色）', () => {
        const out = render(makeNode({ name: '单据' }))

        expect(out).toContain('<meta name="color-scheme" content="light">')
        expect(out).toContain('color-scheme: light')
        expect(out).not.toContain('prefers-color-scheme')
    })

    it('html lang 随注入 locale（en-US 对照）', () => {
        const out = generateTaskHtml(
            makeNode({ name: 'doc' }),
            { ...htmlLabels, lang: 'en-US' } as never,
            GENERATED_AT
        )
        expect(out).toContain('<html lang="en-US">')
    })

    it('generatedAt 由调用方注入并出现在单据脚注', () => {
        expect(render(makeNode({ name: '单据' }))).toContain(GENERATED_AT)
    })

    it('相同输入 ⇒ 逐字符一致的确定性输出', () => {
        const root = makeNode({ name: '确定性', description: 'x\ny' })
        expect(render(root)).toBe(render(root))
    })
})

describe('generateTaskHtml - 自包含 / 无外部请求（NFR §6 / AC3）', () => {
    it('不含脚本、外链标签、@import、url() 与结构化 src/href', () => {
        const out = render(
            makeNode({
                name: '自包含',
                projectName: '工作',
                tagNames: ['重要'],
                checkItems: [{ name: '检一', isDone: true }],
                children: [makeNode({ name: '子 1' })]
            })
        )
        const lower = out.toLowerCase()

        expect(lower).not.toContain('<script')
        expect(lower).not.toContain('<link')
        expect(lower).not.toContain('<img')
        expect(lower).not.toContain('<iframe')
        expect(lower).not.toContain('@import')
        expect(lower).not.toContain('url(')
        expect(out).not.toMatch(/\ssrc\s*=\s*["']/)
        expect(out).not.toMatch(/\shref\s*=\s*["']/)
    })

    it('样式使用字面值（不引用 --nue-* 变量，外部环境不可依赖）', () => {
        expect(render(makeNode({ name: '字面值' }))).not.toContain('--nue-')
    })
})

describe('generateTaskHtml - 五字符转义与注入载荷（NFR §6 / AC4）', () => {
    it('全部插值文本转义：任务名/项目/标签/描述/检查项/子任务', () => {
        const payload = '</style><script>alert(1)</script>'
        const out = render(
            makeNode({
                name: '<img src=x onerror=alert(1)>',
                projectName: `&<>"'`,
                tagNames: ['<b>'],
                description: payload,
                checkItems: [{ name: '<i>', isDone: false }],
                children: [makeNode({ name: '</style>' })]
            })
        )

        // 原始可执行片段一律不存在
        expect(out.toLowerCase()).not.toContain('<script')
        expect(out).not.toContain('<img src=x')
        expect(out).not.toContain('<i>')
        expect(out).not.toContain('<b>')
        // 转义后的实体存在（& < > " '）
        expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;')
        expect(out).toContain('&amp;')
        expect(out).toContain('&lt;')
        expect(out).toContain('&gt;')
        expect(out).toContain('&quot;')
        expect(out).toContain('&#39;')
        // 载荷中的 </style><script> 必须转义
        expect(out).toContain('&lt;/style&gt;&lt;script&gt;')
    })

    it('描述保留换行且容器声明 white-space: pre-wrap', () => {
        const out = render(makeNode({ name: '换行', description: '第一行\n第二行' }))

        expect(out).toContain('第一行\n第二行')
        expect(out).toContain('white-space: pre-wrap')
    })
})

describe('generateTaskHtml - 空段省略与合计计量（§5.4 / §14.5）', () => {
    it('空描述/空检查项/无子任务 ⇒ 对应段落整段省略', () => {
        const out = render(makeNode({ name: '空段' }))

        expect(out).not.toContain(htmlLabels.description)
        expect(out).not.toContain(htmlLabels.checkItems)
        expect(out).not.toContain(htmlLabels.subTasks)
        expect(out).not.toContain(htmlLabels.total)
    })

    it('有内容时对应段标题出现', () => {
        const out = render(
            makeNode({
                name: '有内容',
                description: '说明文字',
                checkItems: [{ name: '检一', isDone: true }],
                children: [makeNode({ name: '子 1' })]
            })
        )

        expect(out).toContain(htmlLabels.description)
        expect(out).toContain(htmlLabels.checkItems)
        expect(out).toContain(htmlLabels.subTasks)
    })

    it('合计段输出分数：检查项 1/2、子任务 2/3（子任务 y 为全层级总数）', () => {
        const out = render(
            makeNode({
                name: '合计',
                checkItems: [
                    { name: '检一', isDone: true },
                    { name: '检二', isDone: false }
                ],
                children: [
                    makeNode({ name: '子 1', state: 'done' }),
                    makeNode({ name: '子 2', state: 'done' }),
                    makeNode({ name: '子 3', state: 'todo' })
                ]
            })
        )

        expect(out).toContain('1/2')
        expect(out).toContain('2/3')
    })

    it('y === 0 的组整行省略（不出现 0/0）；y > 0 且 x === 0 仍输出 0/y；两组皆无 ⇒ 整段省略', () => {
        const onlyCheck = render(
            makeNode({ name: '仅检查项', checkItems: [{ name: '检一', isDone: false }] })
        )
        expect(onlyCheck).not.toContain('0/0')
        // 分母非零（y = 1）⇒ 合计行存在，即使完成数为 0 也输出 0/1（边界钉死）
        expect(onlyCheck).toContain('0/1')

        const empty = render(makeNode({ name: '全空' }))
        expect(empty).not.toContain('0/0')
        expect(empty).not.toContain(htmlLabels.total)
    })
})

describe('generateTaskHtml - 深度上限 5（§5.4 / §5.5 / AC4）', () => {
    it('5 层子任务完整渲染；超过 MAX_EXPORT_DEPTH 的后代不导出', () => {
        const chain = (depth: number, max: number): ExportTaskNode =>
            makeNode({
                name: `L${depth}`,
                children: depth < max ? [chain(depth + 1, max)] : []
            })

        // 根 + L1..L6（根为第 0 层，共 7 层）
        const out = render(makeNode({ name: '根', children: [chain(1, 6)] }))

        expect(out).toContain('L1')
        expect(out).toContain('L2')
        expect(out).toContain('L3')
        expect(out).toContain('L4')
        expect(out).toContain('L5')
        expect(out).not.toContain('L6')
    })
})