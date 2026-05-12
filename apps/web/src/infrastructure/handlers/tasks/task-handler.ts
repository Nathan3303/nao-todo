import type { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { CreateTaskViewObject, TaskViewObject, UpdateTaskViewObject } from '@nao-todo/types'
import dayjs from 'dayjs'
import { NueConfirm, NueMessage } from 'nue-ui'

/**
 * 任务处理程序
 * @param taskUseCase 任务用例
 * @returns 任务处理程序
 */
const useTaskHandler = (taskUseCase: TaskUseCase, subscriber: Subscriber) => {
    /**
     * 创建任务
     * @param createTask 创建任务视图对象
     * @returns 任务实体
     */
    const createTask = async (createTask: CreateTaskViewObject) => {
        const [, err] = await taskUseCase.createTask(createTask)
        if (err !== null) {
            NueMessage.error('创建任务失败：' + `(${unwrapError(err)})`)
            return
        }
        NueMessage.success('创建任务成功')
    }

    /**
     * 更新任务
     * @param taskId 任务ID
     * @param updateOptions 任务视图对象更新选项
     * @returns 任务实体
     */
    const updateTask = async (
        taskId: TaskViewObject['id'],
        updateOptions: UpdateTaskViewObject
    ) => {
        const err = await taskUseCase.updateTask(taskId, updateOptions)
        if (err !== null) {
            NueMessage.error('更新任务失败：' + `(${unwrapError(err)})`)
            return
        }
        NueMessage.success('更新任务成功')
    }

    /**
     * 更新任务名称
     * @param taskId 任务ID
     * @param name 任务任务名称
     * @returns 任务实体
     */
    const updateTaskName = async (taskId: TaskViewObject['id'], name: TaskViewObject['name']) => {
        return await updateTask(taskId, { name })
    }

    /**
     * 更新任务描述
     * @param taskId 任务ID
     * @param description 任务描述
     * @returns 任务实体
     */
    const updateTaskDescription = async (
        taskId: TaskViewObject['id'],
        description: TaskViewObject['description']
    ) => {
        return await updateTask(taskId, { description })
    }

    /**
     * 更新任务状态
     * @param taskId 任务ID
     * @param state 任务状态
     * @returns 任务实体
     */
    const updateTaskState = async (
        taskId: TaskViewObject['id'],
        state: TaskViewObject['state']
    ) => {
        return await updateTask(taskId, { state })
    }

    /**
     * 更新任务优先级
     * @param taskId 任务ID
     * @param priority 任务优先级
     * @returns 任务实体
     */
    const updateTaskPriority = async (
        taskId: TaskViewObject['id'],
        priority: TaskViewObject['priority']
    ) => {
        return await updateTask(taskId, { priority })
    }

    /**
     * 更新任务结束时间
     * @param taskId 任务ID
     * @param endAt 任务结束时间
     * @returns 任务实体
     */
    const updateTaskEndAt = async (
        taskId: TaskViewObject['id'],
        endAt: TaskViewObject['endAt']
    ) => {
        return await updateTask(taskId, { endAt })
    }

    /**
     * 删除任务
     * @param taskId 任务ID
     * @returns 任务实体
     */
    const deleteTask = async (taskId: TaskViewObject['id']) => {
        const err = await taskUseCase.removeTask(taskId)
        if (err !== null) {
            NueMessage.error('删除任务失败：' + `(${unwrapError(err)})`)
            return
        }
        NueMessage.success('删除任务成功')
    }

    /**
     * 恢复任务
     * @param taskId 任务ID
     * @returns 任务实体
     */
    const restoreTask = async (taskId: TaskViewObject['id']) => {
        const err = await taskUseCase.restoreTask(taskId)
        if (err !== null) {
            NueMessage.error('恢复任务失败：' + `(${unwrapError(err)})`)
            return
        }
        NueMessage.success('恢复任务成功')
    }

    /**
     * 更新任务放弃时间
     * @param taskId 任务ID
     * @returns 任务实体
     */
    const giveUpTask = async (taskId: TaskViewObject['id']) => {
        return NueConfirm({
            title: '确认放弃该任务吗？',
            content: '放弃后该任务将移至「已放弃的待办」清单中。是否继续？',
            confirmButtonText: '确认放弃',
            cancelButtonText: '取消',
            onConfirm: async () => {
                await updateTask(taskId, { givenUpAt: dayjs().toISOString() })
            }
        })
    }
    /**
     * 恢复任务放弃时间
     * @param taskId 任务ID
     * @returns 任务实体
     */
    const unGiveUpTask = async (taskId: TaskViewObject['id']) => {
        return await updateTask(taskId, { givenUpAt: null })
    }

    /**
     * 复制任务
     * @param taskId 任务ID
     * @returns 任务实体
     */
    const copyTask = async (
        taskId: TaskViewObject['id'],
        onSuccess?: (taskViewObject: TaskViewObject) => void
    ) => {
        return NueConfirm({
            title: '确认复制该任务吗？',
            content: '复制后该任务将被创建为一个新的任务。是否继续？',
            confirmButtonText: '确认复制',
            cancelButtonText: '取消',
            onConfirm: async () => {
                const [taskViewObject, err] = await taskUseCase.copyTask(taskId)
                if (err !== null) {
                    NueMessage.error('复制任务失败：' + `(${unwrapError(err)})`)
                    return
                }
                NueMessage.success('复制任务成功')
                subscriber.emit('AddNewTaskId', taskViewObject.id)
                onSuccess?.(taskViewObject)
            }
        })
    }

    // @return
    return {
        createTask,
        updateTask,
        updateTaskName,
        updateTaskDescription,
        updateTaskState,
        updateTaskPriority,
        updateTaskEndAt,
        deleteTask,
        restoreTask,
        giveUpTask,
        unGiveUpTask,
        copyTask
    }
}

export default useTaskHandler
export type TaskHandler = ReturnType<typeof useTaskHandler>

