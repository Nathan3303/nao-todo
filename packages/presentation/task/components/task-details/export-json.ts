import type { ExportTaskNode } from './export-markdown'

/**
 * JSON 导出契约（PRD §5.3）
 * @description 纯函数：任务树 → 固定全量 schema 的 JSON 文本。
 *              空值标量/时间归一为 `null`（空串亦归一），空数组输出 `[]`，键永不省略；
 *              时间原样保留 ISO 字符串；`description` 保留原始换行；
 *              递归字段名为 `subTasks`（源内部字段 `children`）。
 */

/** 空值归一：空串 / undefined / null → null（机器口径统一空态） */
const nullableText = (value: string | null | undefined): string | null => value || null

/** JSON 检查项（原样透传） */
type JsonCheckItem = { name: string; isDone: boolean }

/** JSON 任务节点（固定全量 schema，键序即契约） */
type JsonTask = {
    id: string | null
    name: string | null
    state: string | null
    stateLabel: string | null
    priority: string | null
    priorityLabel: string | null
    isGivenUp: boolean
    startAt: string | null
    endAt: string | null
    projectId: string | null
    projectName: string | null
    tagIds: string[]
    tagNames: string[]
    createdAt: string | null
    updatedAt: string | null
    description: string | null
    checkItems: JsonCheckItem[]
    subTasks: JsonTask[]
}

/** 导出节点 → JSON 任务（递归，键序固定） */
const toJsonTask = (node: ExportTaskNode): JsonTask => ({
    id: nullableText(node.id),
    name: nullableText(node.name),
    state: nullableText(node.state),
    stateLabel: nullableText(node.stateLabel),
    priority: nullableText(node.priority),
    priorityLabel: nullableText(node.priorityLabel),
    isGivenUp: node.isGivenUp ?? false,
    startAt: nullableText(node.startAt),
    endAt: nullableText(node.endAt),
    projectId: nullableText(node.projectId),
    projectName: nullableText(node.projectName),
    tagIds: [...(node.tagIds ?? [])],
    tagNames: [...(node.tagNames ?? [])],
    createdAt: nullableText(node.createdAt),
    updatedAt: nullableText(node.updatedAt),
    description: nullableText(node.description),
    checkItems: (node.checkItems ?? []).map((item) => ({ name: item.name, isDone: item.isDone })),
    subTasks: (node.children ?? []).map(toJsonTask)
})

/**
 * 生成任务 JSON 文本
 * @param root 根任务节点（含递归子任务）
 * @param exportedAt 导出时间戳（调用方注入，保持可确定性单测）
 * @returns `JSON.stringify(payload, null, 2)` + 末尾换行
 */
export const generateTaskJson = (root: ExportTaskNode, exportedAt: string): string =>
    JSON.stringify({ formatVersion: 1, exportedAt, task: toJsonTask(root) }, null, 2) + '\n'