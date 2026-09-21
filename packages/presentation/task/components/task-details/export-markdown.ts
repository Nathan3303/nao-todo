import dayjs from 'dayjs'

/**
 * 导出任务节点（任务树 → Markdown 的中间表示）
 * @description 纯数据结构，不依赖 Vue / 不做 I/O；`state`/`priority` 的本地化文案由调用方预先解析，
 *              使生成器本身保持纯函数、可单测。
 */
export type ExportTaskNode = {
    name: string
    /** 领域原始状态（`todo` / `in-progress` / `done`），用于子任务复选框判定 */
    state: string
    /** 已本地化的状态文案 */
    stateLabel: string
    /** 已本地化的优先级文案 */
    priorityLabel: string
    startAt: string | null
    endAt: string | null
    projectName?: string
    tagNames?: string[]
    createdAt: string
    updatedAt: string
    description?: string
    checkItems?: { name: string; isDone: boolean }[]
    children?: ExportTaskNode[]
}

/**
 * 导出 Markdown 的本地化文案
 * @description 由调用方经 i18n 注入，生成器不感知语言。
 */
export type ExportLabels = {
    state: string
    priority: string
    startAt: string
    endAt: string
    project: string
    tags: string
    createdAt: string
    updatedAt: string
    description: string
    checkItems: string
    subTasks: string
}

// 导出时间格式（与需求输出格式一致）
const EXPORT_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm'

// 子任务层级缩进（每层 2 空格）
const INDENT_UNIT = '  '

/**
 * 格式化导出时间为 `YYYY-MM-DD HH:mm`
 * @param value ISO 时间字符串（可空）
 * @returns 合法值返回格式化文本，空值/非法值返回 null（调用方据此省略该行）
 */
export const formatExportDateTime = (value: string | null | undefined): string | null => {
    if (!value) return null
    const date = dayjs(value)
    if (!date.isValid()) return null
    return date.format(EXPORT_DATE_TIME_FORMAT)
}

// 元信息行（值为空则整行省略）
const metaLine = (label: string, value: string | null): string | null =>
    value ? `- ${label}：${value}` : null

// 复选框行（depth 决定缩进层级）
const checkboxLine = (name: string, isDone: boolean, depth: number): string =>
    `${INDENT_UNIT.repeat(depth)}- [${isDone ? 'x' : ' '}] ${name}`

// 描述单行化：去首尾空白后，将内部换行折叠为空格
const inlineDescription = (value: string | undefined): string =>
    (value ?? '').trim().replace(/\s*\n+\s*/g, ' ')

// 子任务缩进：一级 0 空格，每深一级 +4 空格（见 PRD §5.2 递归规则）
const subTaskIndent = (depth: number): string => INDENT_UNIT.repeat(depth * 2)

/**
 * 渲染子任务子树
 * @description 名称行仅「复选框 + 名称」；一级（depth 0）属性走独立子行（缩进 2，顺序固定、空项整行省略）；
 *              每个含子节点的节点各输出一段 `- 子任务：` 标签段（缩进 +2），其子项缩进 +4；
 *              更深层级一律精简（无属性子行）。
 */
const renderSubTask = (node: ExportTaskNode, depth: number, labels: ExportLabels): string[] => {
    const isDone = node.state === 'done'
    const indent = subTaskIndent(depth)
    const propertyIndent = indent + INDENT_UNIT
    const lines = [`${indent}- [${isDone ? 'x' : ' '}] ${node.name}`]

    // 一级：属性子行（顺序固定：状态 → 优先级 → 开始 → 截止 → 标签 → 描述 → 检查项）
    if (depth === 0) {
        if (node.stateLabel) lines.push(`${propertyIndent}- ${labels.state}：${node.stateLabel}`)
        if (node.priorityLabel)
            lines.push(`${propertyIndent}- ${labels.priority}：${node.priorityLabel}`)
        const startAt = formatExportDateTime(node.startAt)
        if (startAt) lines.push(`${propertyIndent}- ${labels.startAt}：${startAt}`)
        const endAt = formatExportDateTime(node.endAt)
        if (endAt) lines.push(`${propertyIndent}- ${labels.endAt}：${endAt}`)
        if (node.tagNames?.length) {
            const tags = node.tagNames.map((name) => `#${name}`).join(' ')
            lines.push(`${propertyIndent}- ${labels.tags}：${tags}`)
        }
        const description = inlineDescription(node.description)
        if (description) lines.push(`${propertyIndent}- ${labels.description}：${description}`)

        const checkItems = node.checkItems ?? []
        if (checkItems.length) {
            lines.push(`${propertyIndent}- ${labels.checkItems}：`)
            for (const item of checkItems) {
                lines.push(checkboxLine(item.name, item.isDone, depth * 2 + 2))
            }
        }
    }

    // 子节点：每个含子节点的节点各输出一段 `- 子任务：` 标签段
    if (node.children?.length) {
        lines.push(`${propertyIndent}- ${labels.subTasks}：`)
        for (const child of node.children) {
            lines.push(...renderSubTask(child, depth + 1, labels))
        }
    }
    return lines
}

/**
 * 生成任务 Markdown 文本
 * @description 纯函数：任务树 → Markdown。
 *              空描述 / 空检查项 / 空子任务对应段落整段省略（不留空标题）；
 *              子任务按层级递归输出（一级 0 缩进，每深一级 +4 空格）。
 * @param root 根任务节点（含递归子任务）
 * @param labels 本地化文案
 * @returns Markdown 文本（末尾换行）
 */
export const generateTaskMarkdown = (root: ExportTaskNode, labels: ExportLabels): string => {
    const blocks: string[] = [`# ${root.name}`]

    // 元信息（逐行省略空值）
    const meta = [
        metaLine(labels.state, root.stateLabel),
        metaLine(labels.priority, root.priorityLabel),
        metaLine(labels.startAt, formatExportDateTime(root.startAt)),
        metaLine(labels.endAt, formatExportDateTime(root.endAt)),
        metaLine(labels.project, root.projectName || null),
        metaLine(
            labels.tags,
            root.tagNames?.length ? root.tagNames.map((name) => `#${name}`).join(' ') : null
        ),
        metaLine(labels.createdAt, formatExportDateTime(root.createdAt)),
        metaLine(labels.updatedAt, formatExportDateTime(root.updatedAt))
    ].filter((line): line is string => line !== null)
    if (meta.length) blocks.push(meta.join('\n'))

    // 描述
    if (root.description?.trim()) {
        blocks.push(`## ${labels.description}\n\n${root.description.trim()}`)
    }

    // 检查项
    const checkItems = root.checkItems ?? []
    if (checkItems.length) {
        const lines = checkItems.map((item) => checkboxLine(item.name, item.isDone, 0))
        blocks.push(`## ${labels.checkItems}\n\n${lines.join('\n')}`)
    }

    // 子任务（递归）
    const subTaskLinesOut: string[] = []
    for (const child of root.children ?? []) {
        subTaskLinesOut.push(...renderSubTask(child, 0, labels))
    }
    if (subTaskLinesOut.length) {
        blocks.push(`## ${labels.subTasks}\n\n${subTaskLinesOut.join('\n')}`)
    }

    return blocks.join('\n\n') + '\n'
}