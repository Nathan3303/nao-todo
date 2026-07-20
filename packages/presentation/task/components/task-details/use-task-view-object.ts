import { unwrapError } from '@nao-todo/shared'
import dayjs from 'dayjs'
import { ref } from 'vue'
import type { TaskViewObject, UpdateTaskViewObject } from '@nao-todo/application'
import { TaskUseCase } from '@nao-todo/application'
import { TaskDetailsPreContext } from './context'
import type { TaskDetailsViewObject } from './types'

/**
 * 主任务详情 composable
 * @description 负责拉取主任务详情并组装为任务详情面板视图对象（TaskDetailsViewObject）。
 * @param getTag 获取标签
 * @param getProjectName 获取项目名称
 */
const useTaskViewObject = (
    taskUseCase: TaskUseCase,
    getTag: TaskDetailsPreContext['getTag'],
    getProjectName: TaskDetailsPreContext['getProjectName']
) => {
    // @states
    const task = ref<TaskDetailsViewObject | null>(null) /** 任务视图对象 */
    const loading = ref(false) /** 加载状态 */
    const error = ref('') /** 错误信息 */

    /**
     * 获取任务详情并转换为视图对象
     * @param taskId 任务 ID
     */
    const getTaskDetails = async (taskId?: TaskViewObject['id']) => {
        if (!taskId) return
        error.value = ''
        loading.value = true
        const [_task, err] = await taskUseCase.get(taskId)
        loading.value = false
        if (err !== null) {
            error.value = unwrapError(err)
            return
        }
        task.value = {
            id: _task.id,
            userId: _task.userId,
            parentTaskId: _task.parentTaskId,
            name: _task.name,
            description: _task.description,
            state: _task.state,
            priority: _task.priority,
            startAt: _task.startAt,
            endAt: _task.endAt,
            projectId: _task.projectId,
            tags: _task.tags,
            createdAt: _task.createdAt,
            updatedAt: _task.updatedAt,
            deletedAt: _task.deletedAt,
            starMarkAt: _task.starMarkAt,
            givenUpAt: _task.givenUpAt,
            archivedAt: _task.archivedAt,
            remindAt: _task.remindAt,
            remindRepeat: _task.remindRepeat,
            remindTime: _task.remindTime,
            remindWeekdays: _task.remindWeekdays,
            // Others
            isDone: _task.state === 'done',
            isDeleted: _task.isDeleted,
            isStarMarked: _task.isStarMarked,
            isGivenUp: _task.isGivenUp,
            isArchived: _task.isArchived,
            tagList: _task.tags.map((tagId) => getTag(tagId)!).filter(Boolean),
            projectName: getProjectName(_task.projectId || '')
        }
    }

    /**
     * 更新任务详情
     * @param id 任务 ID
     * @param updateVO 任务更新视图对象
     * @returns 更新结果
     */
    const updateTaskDetails = async (id: TaskViewObject['id'], updateVO: UpdateTaskViewObject) => {
        if (!id) return
        const updateError = await taskUseCase.update(id, updateVO)
        if (updateError !== null) return
        if (task.value === null) return
        task.value = { ...task.value, ...updateVO, updatedAt: dayjs().toISOString() }
    }

    /**
     * 删除任务
     * @param id 任务 ID
     */
    const deleteTask = async (id: TaskViewObject['id']) => {
        if (!id) return
        const deleteError = await taskUseCase.delete(id)
        if (deleteError !== null) return
        if (task.value === null) return
        task.value = { ...task.value, isDeleted: true, deletedAt: dayjs().toISOString() }
    }

    /**
     * 恢复任务
     * @param id 任务 ID
     */
    const restoreTask = async (id: TaskViewObject['id']) => {
        if (!id) return
        const restoreError = await taskUseCase.restore(id)
        if (restoreError !== null) return
        if (task.value === null) return
        task.value.isDeleted = false
        task.value.deletedAt = null
    }

    /**
     * 放弃任务
     * @param id 任务 ID
     */
    const giveUpTask = async (id: TaskViewObject['id']) => {
        if (!id) return
        const updateVO = { givenUpAt: dayjs().toISOString() }
        const giveUpError = await taskUseCase.update(id, updateVO)
        if (giveUpError !== null) return
        if (task.value === null) return
        task.value = { ...task.value, ...updateVO, isGivenUp: true }
    }

    /**
     * 归档任务
     * @param id 任务 ID
     */
    const ungiveUpTask = async (id: TaskViewObject['id']) => {
        if (!id) return
        const updateVO = { givenUpAt: '' }
        const ungiveUpError = await taskUseCase.update(id, updateVO)
        if (ungiveUpError !== null) return
        if (task.value === null) return
        task.value = { ...task.value, ...updateVO, isGivenUp: false }
    }

    // @returns
    return {
        task,
        loading,
        error,
        getTaskDetails,
        updateTaskDetails,
        deleteTask,
        restoreTask,
        giveUpTask,
        ungiveUpTask
    }
}

export default useTaskViewObject
