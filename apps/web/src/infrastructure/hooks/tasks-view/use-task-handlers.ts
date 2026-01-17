import type { TaskApp } from '@nao-todo/application/task'
import type { TaskVO } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/utils'
import { NueMessage } from 'nue-ui'

export interface TaskHandlers {
    deleteTask: (taskId: TaskVO['id']) => Promise<void>
    restoreTask: (taskId: TaskVO['id']) => Promise<void>
}

const useTaskHandlers = (taskApp: TaskApp) => {
    // @method 删除任务
    const deleteTask = async (taskId: TaskVO['id']) => {
        // 1. 校验参数
        if (!taskId) {
            NueMessage.error('任务ID不能为空')
            return
        }
        // 2. 删除任务
        const err = await taskApp.remove(taskId)
        if (err !== null) {
            NueMessage.error('任务删除失败' + unwrapError(err))
            return
        }
        // 3. 删除成功
        NueMessage.success('任务删除成功')
    }

    // @method 恢复任务
    const restoreTask = async (taskId: TaskVO['id']) => {
        // 1. 校验参数
        if (!taskId) {
            NueMessage.error('任务恢复失败：参数错误')
            return
        }
        // 2. 恢复任务
        const err = await taskApp.restore(taskId)
        if (err !== null) {
            NueMessage.error('任务恢复失败：' + unwrapError(err))
            return
        }
        // 3. 恢复成功
        NueMessage.success('任务恢复成功')
    }

    // @returns
    return {
        deleteTask,
        restoreTask
    }
}

export default useTaskHandlers
