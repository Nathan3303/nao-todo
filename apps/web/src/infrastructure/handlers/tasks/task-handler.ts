import type { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { CreateTaskViewObject, TaskViewObject, UpdateTaskViewObject } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { NueConfirm, NueMessage } from 'nue-ui'
import dayjs from 'dayjs'

const useTaskHandler = (taskUseCase: TaskUseCase) => {
    // @method 创建任务
    const createTask = async (createTask: CreateTaskViewObject) => {
        const [, err] = await taskUseCase.createTask(createTask)
        if (err !== null) {
            NueMessage.error('创建任务失败：' + `(${unwrapError(err)})`)
            return
        }
        NueMessage.success('创建任务成功')
    }

    // @method 更新任务
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

    // @method 更新任务名称
    const updateTaskName = async (taskId: TaskViewObject['id'], name: TaskViewObject['name']) => {
        return await updateTask(taskId, { name })
    }

    // @method 更新任务描述
    const updateTaskDescription = async (
        taskId: TaskViewObject['id'],
        description: TaskViewObject['description']
    ) => {
        return await updateTask(taskId, { description })
    }

    // @method 更新任务状态
    const updateTaskState = async (
        taskId: TaskViewObject['id'],
        state: TaskViewObject['state']
    ) => {
        return await updateTask(taskId, { state })
    }

    // @method 更新任务优先级
    const updateTaskPriority = async (
        taskId: TaskViewObject['id'],
        priority: TaskViewObject['priority']
    ) => {
        return await updateTask(taskId, { priority })
    }

    // @method 更新任务结束时间
    const updateTaskEndAt = async (
        taskId: TaskViewObject['id'],
        endAt: TaskViewObject['endAt']
    ) => {
        return await updateTask(taskId, { endAt })
    }

    // @method 删除任务
    const deleteTask = async (taskId: TaskViewObject['id']) => {
        const err = await taskUseCase.removeTask(taskId)
        if (err !== null) {
            NueMessage.error('删除任务失败：' + `(${unwrapError(err)})`)
            return
        }
        NueMessage.success('删除任务成功')
    }

    // @method 恢复任务
    const restoreTask = async (taskId: TaskViewObject['id']) => {
        const err = await taskUseCase.restoreTask(taskId)
        if (err !== null) {
            NueMessage.error('恢复任务失败：' + `(${unwrapError(err)})`)
            return
        }
        NueMessage.success('恢复任务成功')
    }

    // @method 更新任务放弃时间
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

    // @method 恢复任务放弃时间
    const unGiveUpTask = async (taskId: TaskViewObject['id']) => {
        return await updateTask(taskId, { givenUpAt: null })
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
        unGiveUpTask
    }
}

export default useTaskHandler
export type TaskHandler = ReturnType<typeof useTaskHandler>


