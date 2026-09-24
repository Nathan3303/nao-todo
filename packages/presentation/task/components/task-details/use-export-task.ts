import { inject, ref } from 'vue'
import { NueMessage } from 'nue-ui'
import dayjs from 'dayjs'
import { getLocale, t } from '@nao-todo/shared/locales'
import { unwrapError } from '@nao-todo/shared/utils/user-facing-go-error'
import { type GoAsync } from '@nao-todo/shared/types'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTaskDetailsStore } from '../../stores'
import { TASK_DETAILS_CONTEXT_KEY, TASK_DETAILS_PRE_CONTEXT_KEY } from './context'
import { generateTaskMarkdown, type ExportLabels, type ExportTaskNode } from './export-markdown'
import { generateTaskJson } from './export-json'
import { generateTaskHtml, type ExportHtmlLabels } from './export-html'

/**
 * 导出递归最大深度
 * @description 防御性上限（领域仅允许一级子任务，正常不会触达），防止异常数据造成无限递归。
 */
export const MAX_EXPORT_DEPTH = 5

/** 导出状态机（PRD §5.1）：`idle` 未开始 / `loading` 取数中 / `error` 失败 / `ready` 可取 */
export type ExportStatus = 'idle' | 'loading' | 'error' | 'ready'

// 子任务单页拉取上限（不足时按分页续取，直至取尽）
const SUB_TASK_PAGE_LIMIT = 100

// 单据开具时间格式（HTML 展示口径；JSON 走 ISO）
const GENERATED_AT_FORMAT = 'YYYY-MM-DD HH:mm'

/**
 * 导出任务文本（Markdown / JSON / HTML 单据）composable
 * @description 递归拉取子任务 → 组装任务树 → 调用纯函数生成三格式 → 复制到剪贴板。
 *              取数走 `subTaskUseCase.list({ parentTaskId })`（逐层分页取尽）；
 *              任务视图对象经 TaskDetailsStore 取回（与子任务加载器同一存储）。
 *              `startExport()` / `retry()` 共用状态机实现：一次取数产出三格式，格式切换零重取。
 * @returns 导出状态与动作
 */
const useExportTask = () => {
    // @context 主任务详情上下文（当前任务 + 检查项）
    const { vo, checkItems } = inject(TASK_DETAILS_CONTEXT_KEY)!
    // @context 任务详情预上下文（子任务用例 + 检查项只读取数 + 标签/清单名解析）
    const { subTaskUseCase, taskCheckItemUseCase, getTag, getProjectName } = inject(
        TASK_DETAILS_PRE_CONTEXT_KEY
    )!

    // @store 任务详情存储（子任务视图对象来源）
    const taskDetailsStore = useTaskDetailsStore()

    // @states
    const exporting = ref(false) /** 是否正在生成（TASK-13 兼容字段） */
    const status = ref<ExportStatus>('idle') /** 导出状态机 */
    const markdown = ref('') /** 生成的 Markdown 文本 */
    const json = ref('') /** 生成的 JSON 文本 */
    const html = ref('') /** 生成的 HTML 单据文档 */
    const error = ref('') /** 导出错误信息 */

    // @method 本地化文案（Markdown）
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

    // @method 本地化文案（HTML 单据；`lang` 随当前 locale）
    const resolveHtmlLabels = (): ExportHtmlLabels => ({
        lang: getLocale().value,
        total: t('task.details.export.label.total'),
        checkItems: t('task.details.export.heading.checkItems'),
        subTasks: t('task.details.export.heading.subTasks'),
        state: t('task.details.export.label.state'),
        priority: t('task.details.export.label.priority'),
        startAt: t('task.details.export.label.startAt'),
        endAt: t('task.details.export.label.endAt'),
        project: t('task.details.export.label.project'),
        tags: t('task.details.export.label.tags'),
        createdAt: t('task.details.export.label.createdAt'),
        updatedAt: t('task.details.export.label.updatedAt'),
        description: t('task.details.export.heading.description'),
        issuedAt: t('task.details.export.label.issuedAt'),
        documentNo: t('task.details.export.label.documentNo'),
        generatedBy: t('task.details.export.label.generatedBy')
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
        id: task.id,
        name: task.name,
        state: task.state,
        stateLabel: resolveStateLabel(task),
        priority: task.priority,
        priorityLabel: resolvePriorityLabel(task),
        isGivenUp: task.isGivenUp,
        startAt: task.startAt,
        endAt: task.endAt,
        projectId: task.projectId,
        projectName: getProjectName(task.projectId || '') || undefined,
        tagIds: task.tags ?? [],
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

        // 3. 递归下钻；仅一级子任务（depth 0）取检查项（只读取数，不写 store）
        const nodes: ExportTaskNode[] = []
        for (const child of children) {
            const [grandChildren, err] = await fetchChildren(child.id, depth + 1)
            if (err !== null) return [null, err]
            const node = toExportNode(child, grandChildren)
            if (depth === 0) {
                const [checkItemVOs, checkItemErr] = await taskCheckItemUseCase.listByTask(child.id)
                if (checkItemErr !== null) return [null, checkItemErr]
                node.checkItems = (checkItemVOs ?? []).map((item) => ({
                    name: item.name,
                    isDone: item.isDone
                }))
            }
            nodes.push(node)
        }
        return [nodes, null]
    }

    /**
     * 组装导出节点树（根节点 + 递归子任务 + 根检查项）
     * @returns 任务树；失败写入 `error` 并返回 null
     */
    const buildExportNode = async (): Promise<ExportTaskNode | null> => {
        if (!vo.value) return null
        const root = vo.value
        const [children, err] = await fetchChildren(root.id, 0)
        if (err !== null) {
            error.value = unwrapError(err)
            return null
        }
        return {
            ...toExportNode(root, children),
            checkItems: checkItems.value.map((item) => ({ name: item.name, isDone: item.isDone }))
        }
    }

    // @method 失败提示（统一 toast，错误文案空则回退加载失败）
    const notifyExportFailure = () =>
        NueMessage.error(
            t('task.details.export.failed', { error: error.value || t('task.error.loadFailed') })
        )

    /**
     * 由同一任务树渲染三格式输出
     * @description 时间戳在生成时取一次，保证同一次导出内三格式一致。
     */
    const renderOutputs = (node: ExportTaskNode) => {
        const now = dayjs()
        return {
            markdown: generateTaskMarkdown(node, resolveLabels()),
            json: generateTaskJson(node, now.toISOString()),
            html: generateTaskHtml(node, resolveHtmlLabels(), now.format(GENERATED_AT_FORMAT))
        }
    }

    /**
     * 执行导出（TASK-13 兼容路径）：生成 Markdown 并写入 `markdown`
     * @returns Markdown 文本；失败返回 null（已提示错误）
     */
    const exportTask = async (): Promise<string | null> => {
        exporting.value = true
        error.value = ''
        try {
            const node = await buildExportNode()
            if (node === null) {
                notifyExportFailure()
                return null
            }
            markdown.value = generateTaskMarkdown(node, resolveLabels())
            return markdown.value
        } finally {
            exporting.value = false
        }
    }

    /**
     * 开始导出（打开对话框触发）：`idle`/`error` → `loading` → `ready` | `error`
     * @description 与 `retry()` 共用实现；`loading` 期间重复触发被忽略（防重入）。
     *              成功后三格式一并缓存，格式切换零重取。
     * @returns Markdown 文本；失败返回 null（已提示错误）
     */
    const startExport = async (): Promise<string | null> => {
        if (status.value === 'loading') return null
        status.value = 'loading'
        error.value = ''
        const node = await buildExportNode()
        if (node === null) {
            status.value = 'error'
            notifyExportFailure()
            return null
        }
        const outputs = renderOutputs(node)
        markdown.value = outputs.markdown
        json.value = outputs.json
        html.value = outputs.html
        status.value = 'ready'
        return outputs.markdown
    }

    /** 框内重试：复用 `startExport`（loading 期间防重入） */
    const retry = (): Promise<string | null> => startExport()

    /** 关框重置：回 `idle` 并清空错误与三格式缓存 */
    const reset = () => {
        status.value = 'idle'
        error.value = ''
        markdown.value = ''
        json.value = ''
        html.value = ''
    }

    /**
     * 复制文本到剪贴板
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
        status,
        markdown,
        json,
        html,
        error,
        exportTask,
        startExport,
        retry,
        reset,
        copyMarkdown
    }
}

export default useExportTask