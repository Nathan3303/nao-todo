import { ref } from 'vue'
import dayjs from 'dayjs'
import { t, type GoError } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { translateTaskError } from '../../utils/error-message'
import type { TaskHandler } from '../../handlers'
import type { BatchOpResult, BatchOperation } from './types'

/**
 * 批量执行器配置
 */
export type BatchExecutorOptions = {
    handler: TaskHandler
    getTask: (taskId: string) => TaskViewObject | undefined
}

/**
 * 批量执行器
 * @description 逐任务调用 TaskHandler，单条失败不中断，汇总返回结果
 */
export const useBatchExecutor = ({ handler, getTask }: BatchExecutorOptions) => {
    const isRunning = ref(false)

    /**
     * 执行单条任务操作
     * @param taskId 任务 ID
     * @param op 批量操作
     * @returns 错误或空
     */
    const executeOne = async (taskId: string, op: BatchOperation): Promise<GoError> => {
        switch (op.kind) {
            case 'updateState':
                return await handler.updateTaskState(taskId, op.payload)
            case 'updatePriority':
                return await handler.updateTaskPriority(taskId, op.payload)
            case 'updateEndAt':
                return await handler.update(taskId, { endAt: op.payload })
            case 'updateProject':
                return await handler.update(taskId, { projectId: op.payload })
            case 'addTags': {
                const task = getTask(taskId)
                if (!task) return t('task.multiSelect.taskNotFound')
                const mergedTags = Array.from(new Set([...(task.tags ?? []), ...op.payload]))
                return await handler.update(taskId, { tags: mergedTags })
            }
            case 'removeTags': {
                const task = getTask(taskId)
                if (!task) return t('task.multiSelect.taskNotFound')
                const filteredTags = (task.tags ?? []).filter(
                    (tagId) => !op.payload.includes(tagId)
                )
                return await handler.update(taskId, { tags: filteredTags })
            }
            case 'giveUp':
                return await handler.update(taskId, { givenUpAt: dayjs().toISOString() })
            case 'ungiveUp':
                return await handler.unGiveUp(taskId)
            case 'delete':
                return await handler.delete(taskId)
            case 'restore':
                return await handler.restore(taskId)
        }
    }

    /**
     * 执行批量操作
     * @param op 批量操作
     * @param taskIds 任务 ID 列表
     * @returns 批量操作结果
     */
    const run = async (
        op: BatchOperation,
        taskIds: TaskViewObject['id'][]
    ): Promise<BatchOpResult> => {
        isRunning.value = true
        const errors: BatchOpResult['errors'] = []
        let succeeded = 0
        for (const taskId of taskIds) {
            try {
                const err = await executeOne(taskId, op)
                if (err) errors.push({ taskId, message: translateTaskError(err) })
                else succeeded++
            } catch (error) {
                errors.push({ taskId, message: translateTaskError(error as GoError) })
            }
        }
        isRunning.value = false
        return { total: taskIds.length, succeeded, failed: errors.length, errors }
    }

    return { isRunning, run }
}