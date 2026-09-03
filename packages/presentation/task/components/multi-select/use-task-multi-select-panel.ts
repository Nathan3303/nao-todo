import { computed } from 'vue'
import { NueConfirm, NueMessage } from 'nue-ui'
import { t } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '../../stores'
import { useBatchExecutor } from './use-batch-executor'
import type {
    BatchOpResult,
    BatchOperation,
    TaskMultiSelectPanelEmits,
    TaskMultiSelectPanelProps
} from './types'

/**
 * 多选编辑面板逻辑
 * @param props 面板属性
 * @param emit 面板事件
 */
export const useTaskMultiSelectPanel = (
    props: TaskMultiSelectPanelProps,
    emit: TaskMultiSelectPanelEmits
) => {
    const tasksStore = useTasksStore()

    // @hook 批量执行器
    const executor = useBatchExecutor({
        handler: props.taskHandler,
        getTask: (taskId) => tasksStore.getTask(taskId)
    })

    // @computed 已选任务对象
    const selectedTasks = computed<TaskViewObject[]>(() =>
        props.selectedIds
            .map((taskId) => tasksStore.getTask(taskId))
            .filter((task): task is TaskViewObject => !!task)
    )

    // @computed 是否包含已删除任务
    const hasTrashedTask = computed(() => selectedTasks.value.some((task) => task.isDeleted))

    // @computed 是否禁用批量操作
    const actionsDisabled = computed(() => hasTrashedTask.value || executor.isRunning.value)

    /**
     * 汇总提示
     * @param result 批量操作结果
     */
    const showBatchSummary = (result: BatchOpResult) => {
        if (result.failed > 0) {
            NueMessage.error(
                t('task.multiSelect.batchFailed', {
                    succeeded: result.succeeded,
                    failed: result.failed
                })
            )
        } else {
            NueMessage.success(t('task.multiSelect.batchSuccess', { count: result.succeeded }))
        }
    }

    /**
     * 执行批量操作
     * @param op 批量操作
     * @returns 操作结果，被禁用时返回 null
     */
    const applyBatch = async (op: BatchOperation): Promise<BatchOpResult | null> => {
        if (actionsDisabled.value) return null
        const result = await executor.run(op, props.selectedIds)
        showBatchSummary(result)
        return result
    }

    /**
     * 确认后执行批量操作（软破坏性动作）
     * @param op 批量操作
     * @param confirmTitle 确认标题
     * @param confirmContent 确认内容
     * @returns 是否执行成功
     */
    const confirmAndApply = async (
        op: BatchOperation,
        confirmTitle: string,
        confirmContent: string,
        confirmButtonText: string
    ): Promise<boolean> => {
        const [isByCancel] = await NueConfirm({
            title: confirmTitle,
            content: confirmContent,
            confirmButtonText,
            cancelButtonText: t('common.cancel')
        })
        if (isByCancel) return false
        const result = await applyBatch(op)
        return !!result && result.succeeded > 0
    }

    // @method 属性批量设置
    const handleSetState = (state: unknown) =>
        applyBatch({ kind: 'updateState', payload: state as TaskViewObject['state'] })
    const handleSetPriority = (priority: unknown) =>
        applyBatch({ kind: 'updatePriority', payload: priority as TaskViewObject['priority'] })
    const handleSetEndAt = (endAt: string | null) =>
        applyBatch({ kind: 'updateEndAt', payload: endAt })
    const handleMoveProject = (projectId: string) =>
        applyBatch({ kind: 'updateProject', payload: projectId })
    const handleAddTag = (tagId: string) => applyBatch({ kind: 'addTags', payload: [tagId] })
    const handleRemoveTag = (tagId: string) => applyBatch({ kind: 'removeTags', payload: [tagId] })

    // @method 删除（软破坏性）
    const handleDelete = async () => {
        const succeeded = await confirmAndApply(
            { kind: 'delete' },
            t('task.multiSelect.deleteConfirmTitle'),
            t('task.multiSelect.deleteConfirmContent', { n: props.selectedIds.length }),
            t('dialog.confirmDelete')
        )
        if (succeeded) emit('cleared')
    }

    // @method 恢复
    const handleRestore = () => applyBatch({ kind: 'restore' })

    // @method 放弃（软破坏性）
    const handleGiveUp = async () => {
        const succeeded = await confirmAndApply(
            { kind: 'giveUp' },
            t('task.multiSelect.giveUpConfirmTitle'),
            t('task.multiSelect.giveUpConfirmContent', { n: props.selectedIds.length }),
            t('task.confirmGiveUp')
        )
        if (succeeded) emit('cleared')
    }

    // @method 取消放弃
    const handleUngiveUp = () => applyBatch({ kind: 'ungiveUp' })

    return {
        executor,
        selectedTasks,
        hasTrashedTask,
        actionsDisabled,
        handleSetState,
        handleSetPriority,
        handleSetEndAt,
        handleMoveProject,
        handleAddTag,
        handleRemoveTag,
        handleDelete,
        handleRestore,
        handleGiveUp,
        handleUngiveUp
    }
}