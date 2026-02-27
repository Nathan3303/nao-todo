import type { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import type { CreateTask, Task, UpdateTaskOptions } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { NueMessage } from 'nue-ui'

const useTaskHandler = (taskUseCase: TaskUseCase) => {
    // @method 创建任务
    const createTask = async (createTask: CreateTask) => {
        const [, err] = await taskUseCase.createTask(createTask)
        if (err !== null) {
            NueMessage.error('创建任务失败：' + `(${unwrapError(err)})`)
            return
        }
        NueMessage.success('创建任务成功')
    }

    // @method 更新任务
    const updateTask = async (taskId: Task['id'], updateOptions: UpdateTaskOptions) => {
        const err = await taskUseCase.updateTask(taskId, updateOptions)
        if (err !== null) {
            NueMessage.error('更新任务失败：' + `(${unwrapError(err)})`)
            return
        }
        NueMessage.success('更新任务成功')
    }

    // @method 更新任务名称
    const updateTaskName = async (taskId: Task['id'], name: Task['name']) => {
        return await updateTask(taskId, { name })
    }

    // @method 更新任务描述
    const updateTaskDescription = async (taskId: Task['id'], description: Task['description']) => {
        return await updateTask(taskId, { description })
    }

    // @method 更新任务状态
    const updateTaskState = async (taskId: Task['id'], state: Task['state']) => {
        return await updateTask(taskId, { state })
    }

    // @method 更新任务优先级
    const updateTaskPriority = async (taskId: Task['id'], priority: Task['priority']) => {
        return await updateTask(taskId, { priority })
    }

    // @method 更新任务结束时间
    const updateTaskEndAt = async (taskId: Task['id'], endAt: Task['endAt']) => {
        return await updateTask(taskId, { endAt })
    }

    // @return
    return {
        createTask,
        updateTask,
        updateTaskName,
        updateTaskDescription,
        updateTaskState,
        updateTaskPriority,
        updateTaskEndAt
    }
}

export default useTaskHandler
export type TaskHandler = ReturnType<typeof useTaskHandler>
