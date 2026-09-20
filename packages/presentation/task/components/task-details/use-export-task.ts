import { inject, ref } from 'vue'
import { NueMessage } from 'nue-ui'
import { t, unwrapError, type GoAsync } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTaskDetailsStore } from '../../stores'
import { TASK_DETAILS_CONTEXT_KEY, TASK_DETAILS_PRE_CONTEXT_KEY } from './context'
import { generateTaskMarkdown, type ExportLabels, type ExportTaskNode } from './export-markdown'

/**
 * 导出递归最大深度
 * @description 防御性上限（领域仅允许一级子任务，正常不会触达），防止异常数据造成无限递归。
 */
export const MAX_EXPORT_DEPTH = 5

// 子任务单页拉取上限（不足时按分页续取，直至取尽）
const SUB_TASK_PAGE_LIMIT = 100

/**
 * 导出任务文本（Markdown）composable
 * @description 递归拉取子任务 → 组装任务树 → 调用纯函数生成 Markdown → 复制到剪贴板。
 *              取数走 `subTaskUseCase.list({ parentTaskId })`（逐层分页取尽）；
 *              任务视图对象经 TaskDetailsStore 取回（与子任务加载器同一存储）。
 * @returns 导出状态与动作
 */
const useExportTask = () => {
    // @context 主任务详情上下文（当前任务 + 检查项）
    const { vo, checkItems } = inject(TASK_DETAILS_CONTEXT_KEY)!
    // @context 任务详情预上下文（子任务用例 + 标签/清单名解析）
    const { subTaskUseCase, getTag, getProjectName } = inject(TASK_DETAILS_PRE_CONTEXT_KEY)!

    // @store 任务详情存储（子任务视图对象来源）
    const taskDetailsStore = useTaskDetailsStore()

    // @states
    const exporting = ref(false) /** 是否正在生成 */
    const markdown = ref('') /** 生成的 Markdown 文本 */
    const error = ref('') /** 导出错误信息 */

    // @method 本地化文案（每次调用重取，随 locale 变化）
    const resolveLabels = (): ExportLabels => ({
        state: t('task.details.export.label.state'),
        priority: t('task.details.export.label.priority'),
        startAt: t('task.details.export.label.startAt'),
        endAt: t('task.details.export.label.endAt'),
        project: t('task.details.export.label.project'),
        tags: t('task.details.export.label.tags'),
        createdAt: t('task.details.export.label.createdAt'),
        updatedAt: t('task.details.export.label.updatedAt'),
        description: t('task.details.export.heading.description'),
        checkItems: t('task.details.export.heading.checkItems'),
        subTasks: t('task.details.export.heading.subTasks')
    })

    // @method 状态文案（已放弃优先；其余走状态键）
    const resolveStateLabel = (task: TaskViewObject): string => {
        if (task.isGivenUp) return t('task.givenUp')
        if (task.state === 'done') return t('task.state.done')
        if (task.state === 'in-progress') return t('task.state.inProgress')
        return t('task.state.todo')
    }

    // @method 优先级文案
    const resolvePriorityLabel = (task: TaskViewObject): string => {
        if (task.priority === 'high') return t('task.priority.high')
        if (task.priority === 'medium') return t('task.priority.medium')
        return t('task.priority.low')
    }

    // @method 任务视图对象 → 导出节点
    const toExportNode = (task: TaskViewObject, children: ExportTaskNode[]): ExportTaskNode => ({
        name: task.name,
        state: task.state,
        stateLabel: resolveStateLabel(task),
        priorityLabel: resolvePriorityLabel(task),
        startAt: task.startAt,
        endAt: task.endAt,
        projectName: getProjectName(task.projectId || '') || undefined,
        tagNames: (task.tags ?? [])
            .map((tagId) => getTag(tagId)?.name)
            .filter((name): name is string => Boolean(name)),
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        description: task.description,
        children
    })

    /**
     * 递归拉取子任务节点
     * @param parentId 父任务 ID
     * @param depth 当前深度（0 = 直接子任务）
     * @returns 子任务节点列表
     */
    const fetchChildren = async (
        parentId: TaskViewObject['id'],
        depth: number
    ): GoAsync<ExportTaskNode[]> => {
        // 深度上限：不再向下取数
        if (depth >= MAX_EXPORT_DEPTH) return [[], null]

        // 1. 逐页取尽子任务 ID
        const ids: TaskViewObject['id'][] = []
        let page = 1
        while (true) {
            const [result, err] = await subTaskUseCase.list({
                parentTaskId: parentId,
                page,
                limit: SUB_TASK_PAGE_LIMIT
            })
            if (err !== null) return [null, err]
            ids.push(...result.taskIds)
            const maxPage = result.pagination?.maxPage ?? 1
            if (page >= maxPage || result.taskIds.length === 0) break
            page += 1
        }

        // 2. 取回视图对象并按组内序排序（sortId ASC, id ASC）
        const children = ids
            .map((id) => taskDetailsStore.getTask(id))
            .filter((task): task is TaskViewObject => Boolean(task))
            .sort((a, b) => a.sortId - b.sortId || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

        // 3. 递归下钻
        const nodes: ExportTaskNode[] = []
        for (const child of children) {
            const [grandChildren, err] = await fetchChildren(child.id, depth + 1)
            if (err !== null) return [null, err]
            nodes.push(toExportNode(child, grandChildren))
        }
        return [nodes, null]
    }

    /**
     * 生成当前任务（含递归子任务）的 Markdown
     * @returns Markdown 文本；失败返回 null
     */
    const buildMarkdown = async (): Promise<string | null> => {
        if (!vo.value) return null
        const root = vo.value
        const [children, err] = await fetchChildren(root.id, 0)
        if (err !== null) {
            error.value = unwrapError(err)
            return null
        }
        const node: ExportTaskNode = {
            ...toExportNode(root, children),
            checkItems: checkItems.value.map((item) => ({ name: item.name, isDone: item.isDone }))
        }
        return generateTaskMarkdown(node, resolveLabels())
    }

    /**
     * 执行导出：生成 Markdown 并写入 `markdown`
     * @returns 生成的 Markdown 文本；失败返回 null（已提示错误）
     */
    const exportTask = async (): Promise<string | null> => {
        exporting.value = true
        error.value = ''
        try {
            const result = await buildMarkdown()
            if (result === null) {
                NueMessage.error(
                    t('task.details.export.failed', {
                        error: error.value || t('task.error.loadFailed')
                    })
                )
                return null
            }
            markdown.value = result
            return result
        } finally {
            exporting.value = false
        }
    }

    /**
     * 复制 Markdown 到剪贴板
     * @param text 待复制文本
     * @returns 是否复制成功（失败不静默：错误提示）
     */
    const copyMarkdown = async (text: string): Promise<boolean> => {
        try {
            if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
            await navigator.clipboard.writeText(text)
            NueMessage.success(t('task.details.export.copySuccess'))
            return true
        } catch {
            NueMessage.error(t('task.details.export.copyFailed'))
            return false
        }
    }

    return {
        exporting,
        markdown,
        error,
        exportTask,
        copyMarkdown
    }
}

export default useExportTask