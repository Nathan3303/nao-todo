import { ref } from 'vue'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/usecases/task'
import type { ProjectViewObject } from '@nao-todo/usecases/project'
import type useTagsStore from '@/stores/tags-store'
import type { TaskDetailsViewObject } from './types'

type TagStore = ReturnType<typeof useTagsStore>

/**
 * 主任务详情 composable
 * @description 负责拉取主任务详情并组装为任务详情面板视图对象（TaskDetailsViewObject）。
 * @param taskUseCase 任务用例
 * @param tagStore 标签存储
 * @param getProjectName 获取项目名称
 */
const useTaskViewObject = (
    taskUseCase: TaskUseCase,
    tagStore: TagStore,
    getProjectName: (projectId: ProjectViewObject['id']) => ProjectViewObject['name']
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
            tagList: _task.tags.map((tagId) => tagStore.getTag(tagId)!).filter(Boolean),
            projectName: getProjectName(_task.projectId || '')
        }
    }

    // @returns
    return { task, loading, error, getTaskDetails }
}

export default useTaskViewObject
