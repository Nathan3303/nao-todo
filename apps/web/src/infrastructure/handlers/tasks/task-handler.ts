import type { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { CreateTaskViewObject, TaskViewObject, UpdateTaskViewObject } from '@nao-todo/types'
import dayjs from 'dayjs'
import { NueConfirm, NueMessage } from 'nue-ui'
import { t } from '@nao-todo/infrastructure/locales'

const useTaskHandler = (taskUseCase: TaskUseCase, subscriber: Subscriber) => {
    const createTask = async (createTask: CreateTaskViewObject) => {
        const [, err] = await taskUseCase.createTask(createTask)
        if (err !== null) {
            NueMessage.error(t('task.createFailed', { error: `(${unwrapError(err)})` }))
            return
        }
        NueMessage.success(t('task.createSuccess'))
    }

    const updateTask = async (
        taskId: TaskViewObject['id'],
        updateOptions: UpdateTaskViewObject
    ) => {
        const err = await taskUseCase.updateTask(taskId, updateOptions)
        if (err !== null) {
            NueMessage.error(t('task.updateFailed', { error: `(${unwrapError(err)})` }))
            return
        }
        NueMessage.success(t('task.updateSuccess'))
    }

    const updateTaskName = async (taskId: TaskViewObject['id'], name: TaskViewObject['name']) => {
        return await updateTask(taskId, { name })
    }

    const updateTaskDescription = async (
        taskId: TaskViewObject['id'],
        description: TaskViewObject['description']
    ) => {
        return await updateTask(taskId, { description })
    }

    const updateTaskState = async (
        taskId: TaskViewObject['id'],
        state: TaskViewObject['state']
    ) => {
        return await updateTask(taskId, { state })
    }

    const updateTaskPriority = async (
        taskId: TaskViewObject['id'],
        priority: TaskViewObject['priority']
    ) => {
        return await updateTask(taskId, { priority })
    }

    const updateTaskEndAt = async (
        taskId: TaskViewObject['id'],
        endAt: TaskViewObject['endAt']
    ) => {
        return await updateTask(taskId, { endAt })
    }

    const deleteTask = async (taskId: TaskViewObject['id']) => {
        const err = await taskUseCase.removeTask(taskId)
        if (err !== null) {
            NueMessage.error(t('task.deleteFailed', { error: `(${unwrapError(err)})` }))
            return
        }
        NueMessage.success(t('task.deleteSuccess'))
    }

    const restoreTask = async (taskId: TaskViewObject['id']) => {
        const err = await taskUseCase.restoreTask(taskId)
        if (err !== null) {
            NueMessage.error(t('task.restoreFailed', { error: `(${unwrapError(err)})` }))
            return
        }
        NueMessage.success(t('task.restoreSuccess'))
    }

    const giveUpTask = async (taskId: TaskViewObject['id']) => {
        return NueConfirm({
            title: t('task.confirmGiveUpTitle'),
            content: t('task.confirmGiveUpContent'),
            confirmButtonText: t('task.confirmGiveUp'),
            cancelButtonText: t('common.cancel'),
            onConfirm: async () => {
                await updateTask(taskId, { givenUpAt: dayjs().toISOString() })
            }
        })
    }
    const unGiveUpTask = async (taskId: TaskViewObject['id']) => {
        return await updateTask(taskId, { givenUpAt: null })
    }

    const copyTask = async (
        taskId: TaskViewObject['id'],
        onSuccess?: (taskViewObject: TaskViewObject) => void
    ) => {
        return NueConfirm({
            title: t('task.confirmCopyTitle'),
            content: t('task.confirmCopyContent'),
            confirmButtonText: t('task.confirmCopy'),
            cancelButtonText: t('common.cancel'),
            onConfirm: async () => {
                const [taskViewObject, err] = await taskUseCase.copyTask(taskId)
                if (err !== null) {
                    NueMessage.error(t('task.copyFailed', { error: `(${unwrapError(err)})` }))
                    return
                }
                NueMessage.success(t('task.copySuccess'))
                subscriber.emit('AddNewTaskId', taskViewObject.id)
                onSuccess?.(taskViewObject)
            }
        })
    }

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
