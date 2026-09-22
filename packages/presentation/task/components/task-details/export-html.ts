import { formatExportDateTime, type ExportTaskNode } from './export-markdown'

/**
 * HTML 账单单据导出契约（PRD §5.4 + §14）
 * @description 纯函数：任务树 → 自包含完整 HTML 文档（无 Vue / 无 i18n / 无 I/O）。
 *              固定浅色（纸质单据）、五字符转义、空段整段省略、合计计量条、深度上限 5；
 *              `generatedAt` 与全部文案由调用方注入，保证可确定性单测。
 */

/**
 * HTML 渲染器注入文案（由调用方经 i18n 解析；生成器不感知语言）
 * @description 键集为 T94 钉死的契约，勿改名。
 */
export type ExportHtmlLabels = {
    /** `html lang` 取值（`zh-CN` / `en-US`） */
    lang: string
    total: string
    checkItems: string
    subTasks: string
    state: string
    priority: string
    startAt: string
    endAt: string
    project: string
    tags: string
    createdAt: string
    updatedAt: string
    description: string
    issuedAt: string
    documentNo: string
    generatedBy: string
}

/**
 * 递归深度上限（与 `use-export-task` 的 `MAX_EXPORT_DEPTH` 一致）
 * @description 本地常量：保持本模块零框架依赖（不从 composable 引入 Vue）。
 */
const MAX_EXPORT_DEPTH = 5

/** 单据号展示长度（短 ID） */
const DOCUMENT_NO_LENGTH = 8

/** 五字符转义（覆盖全部插值文本） */
const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

/** 左标签 / 右数值两列行（`mono` 用于时间与单据号等宽数字） */
const metaRow = (label: string, value: string, mono = false): string =>
    `<div class="row"><dt>${escapeHtml(label)}</dt><dd${mono ? ' class="mono"' : ''}>${escapeHtml(value)}</dd></div>`

/** 收集全层级子任务（受深度上限约束） */
const collectSubTasks = (nodes: ExportTaskNode[], depth = 1): ExportTaskNode[] => {
    if (depth > MAX_EXPORT_DEPTH) return []
    return nodes.flatMap((node) => [node, ...collectSubTasks(node.children ?? [], depth + 1)])
}

/** 一级子任务的丰富字段属性块（更深层级仅名称 + 递归） */
const renderSubTaskProps = (node: ExportTaskNode, labels: ExportHtmlLabels): string => {
    const rows: string[] = []
    if (node.stateLabel) rows.push(metaRow(labels.state, node.stateLabel))
    if (node.priorityLabel) rows.push(metaRow(labels.priority, node.priorityLabel))
    const startAt = formatExportDateTime(node.startAt)
    if (startAt) rows.push(metaRow(labels.startAt, startAt, true))
    const endAt = formatExportDateTime(node.endAt)
    if (endAt) rows.push(metaRow(labels.endAt, endAt, true))
    if (node.tagNames?.length) {
        rows.push(metaRow(labels.tags, node.tagNames.map((name) => `#${name}`).join(' ')))
    }
    if (node.description) rows.push(metaRow(labels.description, node.description))
    return rows.length ? `<dl class="props">${rows.join('')}</dl>` : ''
}

/** 递归渲染子任务列表（`depth` 为节点层级，根的子任务 = 1） */
const renderSubTasks = (
    nodes: ExportTaskNode[],
    depth: number,
    labels: ExportHtmlLabels
): string => {
    if (depth > MAX_EXPORT_DEPTH) return ''
    return nodes
        .map((node) => {
            const isDone = node.state === 'done'
            const children = node.children ?? []
            const nested =
                depth < MAX_EXPORT_DEPTH && children.length
                    ? `<ul class="subtasks">${renderSubTasks(children, depth + 1, labels)}</ul>`
                    : ''
            const props = depth === 1 ? renderSubTaskProps(node, labels) : ''
            return (
                `<li class="subtask${isDone ? ' is-done' : ''}">` +
                `<div class="subtask__head"><span class="box"></span>` +
                `<span class="subtask__name">${escapeHtml(node.name)}</span></div>` +
                props +
                nested +
                `</li>`
            )
        })
        .join('')
}

/** 合计计量行（`x/y` 分数 + 纯 CSS 计量条；`y === 0` 调用方不渲染） */
const totalRow = (label: string, done: number, total: number): string => {
    const percent = Math.round((done / total) * 100)
    const complete = done === total
    return (
        `<div class="total__row"><dt>${escapeHtml(label)}</dt><dd>` +
        `<span class="total__meter"><span class="total__fill" style="width:${percent}%"></span></span>` +
        `<span class="mono total__score">${done}/${total}</span>` +
        `${complete ? '<span class="total__done"></span>' : ''}` +
        `</dd></div>`
    )
}

/** 样式表（字面值，禁变量 / 禁外链 / 零动画；规格见 PRD §14.2–§14.5） */
const STYLE = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #FFFFFF; color: #1A1A1A; }
body {
    font-family: -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
    font-size: 14px;
    line-height: 1.6;
    padding: 2rem 1rem;
}
.receipt {
    max-width: 30rem;
    margin: 0 auto;
    padding: 2rem 1.75rem;
    border-top: 3px double #1A1A1A;
}
.receipt__project { margin: 0 0 0.25rem; font-size: 0.75rem; letter-spacing: 0.08em; color: #6B6B6B; }
.receipt__title { margin: 0; font-size: 1.5rem; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
.receipt__badges { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.75rem 0 0; padding: 0; list-style: none; }
.badge { padding: 0.1rem 0.5rem; border: 1px solid #1A1A1A; font-size: 0.75rem; letter-spacing: 0.04em; }
.receipt__meta, .receipt__section, .receipt__foot { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid #D8D8D8; }
.receipt__foot { border-top: 1px dashed #D8D8D8; }
.section__title { margin: 0 0 0.75rem; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; color: #6B6B6B; }
.row { display: grid; grid-template-columns: max-content 1fr; gap: 0.5rem 1rem; align-items: baseline; }
.row + .row { margin-top: 0.25rem; }
.row dt { color: #6B6B6B; font-size: 0.75rem; letter-spacing: 0.08em; }
.row dd { margin: 0; text-align: right; min-width: 0; overflow-wrap: anywhere; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
.description { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.checklist, .subtasks { margin: 0; padding: 0; list-style: none; }
.check, .subtask__head { display: flex; align-items: baseline; gap: 0.5rem; }
.check + .check, .subtask + .subtask { margin-top: 0.5rem; }
.box { flex: none; width: 0.75rem; height: 0.75rem; border: 1px solid #1A1A1A; transform: translateY(1px); }
.is-done > .subtask__head > .box, .check.is-done .box { background: #1A1A1A; }
.check__name, .subtask__name { overflow-wrap: anywhere; }
.check:not(.is-done) .check__name, .subtask:not(.is-done) > .subtask__head > .subtask__name { color: #9A9A9A; }
.props { margin: 0.5rem 0 0 1.25rem; padding-left: 1.25rem; border-left: 1px dashed #D8D8D8; }
.props dd { font-size: 0.875rem; white-space: pre-wrap; }
.subtasks { margin-top: 0.5rem; padding-left: 1.25rem; border-left: 1px dashed #D8D8D8; }
.total__row { display: grid; grid-template-columns: max-content 1fr; gap: 0.5rem 1rem; align-items: center; }
.total__row + .total__row { margin-top: 0.5rem; }
.total__row dt { color: #6B6B6B; font-size: 0.75rem; letter-spacing: 0.08em; }
.total__row dd { display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem; margin: 0; min-width: 0; }
.total__meter { flex: 1 1 auto; max-width: 8rem; height: 6px; background: #E8E8E8; }
.total__fill { display: block; height: 100%; background: #1A1A1A; }
.total__score { font-size: 0.875rem; }
.total__done { flex: none; width: 0.625rem; height: 0.625rem; background: #1A1A1A; }
.receipt__foot p { margin: 0; font-size: 0.75rem; color: #6B6B6B; text-align: center; }
`

/**
 * 生成任务 HTML 账单单据
 * @param root 根任务节点（含递归子任务）
 * @param labels 本地化文案（含 `lang`）
 * @param generatedAt 已格式化的开具时间（调用方注入）
 * @returns 自包含完整 HTML 文档（`</html>` + 末尾换行）
 */
export const generateTaskHtml = (
    root: ExportTaskNode,
    labels: ExportHtmlLabels,
    generatedAt: string
): string => {
    const sections: string[] = []

    // 抬头：项目名（空则省略）+ 任务名 + 状态/优先级徽记（纯描边）
    const project = root.projectName
        ? `<p class="receipt__project">${escapeHtml(root.projectName)}</p>`
        : ''
    const badges: string[] = []
    if (root.stateLabel) badges.push(`<span class="badge">${escapeHtml(root.stateLabel)}</span>`)
    if (root.priorityLabel)
        badges.push(`<span class="badge">${escapeHtml(root.priorityLabel)}</span>`)
    const badgeList = badges.length ? `<p class="receipt__badges">${badges.join('')}</p>` : ''

    // 元信息：开具于 / 单据号 / 时间 / 标签（空值逐行省略）
    const metaRows: string[] = [metaRow(labels.issuedAt, generatedAt, true)]
    if (root.id)
        metaRows.push(metaRow(labels.documentNo, root.id.slice(0, DOCUMENT_NO_LENGTH), true))
    const startAt = formatExportDateTime(root.startAt)
    if (startAt) metaRows.push(metaRow(labels.startAt, startAt, true))
    const endAt = formatExportDateTime(root.endAt)
    if (endAt) metaRows.push(metaRow(labels.endAt, endAt, true))
    const createdAt = formatExportDateTime(root.createdAt)
    if (createdAt) metaRows.push(metaRow(labels.createdAt, createdAt, true))
    const updatedAt = formatExportDateTime(root.updatedAt)
    if (updatedAt) metaRows.push(metaRow(labels.updatedAt, updatedAt, true))
    if (root.tagNames?.length) {
        metaRows.push(metaRow(labels.tags, root.tagNames.map((name) => `#${name}`).join(' ')))
    }

    // 说明（空则整段省略）
    if (root.description) {
        sections.push(
            `<section class="receipt__section"><h2 class="section__title">${escapeHtml(labels.description)}</h2>` +
                `<p class="description">${escapeHtml(root.description)}</p></section>`
        )
    }

    // 检查项（空则整段省略）
    const checkItems = root.checkItems ?? []
    if (checkItems.length) {
        const items = checkItems
            .map(
                (item) =>
                    `<li class="check${item.isDone ? ' is-done' : ''}"><span class="box"></span>` +
                    `<span class="check__name">${escapeHtml(item.name)}</span></li>`
            )
            .join('')
        sections.push(
            `<section class="receipt__section"><h2 class="section__title">${escapeHtml(labels.checkItems)}</h2>` +
                `<ul class="checklist">${items}</ul></section>`
        )
    }

    // 子任务（空则整段省略）
    const children = root.children ?? []
    if (children.length) {
        sections.push(
            `<section class="receipt__section"><h2 class="section__title">${escapeHtml(labels.subTasks)}</h2>` +
                `<ul class="subtasks">${renderSubTasks(children, 1, labels)}</ul></section>`
        )
    }

    // 合计（组行仅当 y > 0 输出，含 x = 0 的 0/y；两组皆无则整段省略）
    const doneCheckItems = checkItems.filter((item) => item.isDone).length
    const allSubTasks = collectSubTasks(children)
    const doneSubTasks = allSubTasks.filter((node) => node.state === 'done').length
    const totalRows: string[] = []
    if (checkItems.length)
        totalRows.push(totalRow(labels.checkItems, doneCheckItems, checkItems.length))
    if (allSubTasks.length)
        totalRows.push(totalRow(labels.subTasks, doneSubTasks, allSubTasks.length))
    if (totalRows.length) {
        sections.push(
            `<section class="receipt__section receipt__total"><h2 class="section__title">${escapeHtml(labels.total)}</h2>` +
                `${totalRows.join('')}</section>`
        )
    }

    return (
        `<!DOCTYPE html>\n` +
        `<html lang="${escapeHtml(labels.lang)}">\n` +
        `<head>\n` +
        `<meta charset="UTF-8">\n` +
        `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
        `<meta name="color-scheme" content="light">\n` +
        `<title>${escapeHtml(root.name)}</title>\n` +
        `<style>${STYLE}</style>\n` +
        `</head>\n` +
        `<body>\n` +
        `<article class="receipt">\n` +
        `<header class="receipt__head">${project}` +
        `<h1 class="receipt__title">${escapeHtml(root.name)}</h1>${badgeList}</header>\n` +
        `<section class="receipt__meta"><dl class="meta">${metaRows.join('')}</dl></section>\n` +
        sections.join('\n') +
        (sections.length ? '\n' : '') +
        `<footer class="receipt__foot"><p>${escapeHtml(labels.generatedBy)} ${escapeHtml(generatedAt)}</p></footer>\n` +
        `</article>\n` +
        `</body>\n` +
        `</html>\n`
    )
}