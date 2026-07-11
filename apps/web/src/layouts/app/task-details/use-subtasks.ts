import { computed } from 'vue'
import useTasksLoader from '@/infrastructure/hooks/use-task-loader'
import { newTaskUseCase, type TaskStore, type TaskViewObject } from '@nao-todo/usecases/task'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type useTaskDetailsStore from '@/stores/tasks/task-details-store'

type TaskDetailsStore = ReturnType<typeof useTaskDetailsStore>

/**
 * 子任务加载器 composable
 * @description 复用 useTasksLoader，以 parentTaskId 为条件加载子任务，
 *              并将数据写入 TaskDetailsStore 中独立的子任务 store（与主任务列表隔离）。
 * @param taskDetailsStore 任务详情存储
 */
const useSubTasks = (taskDetailsStore: TaskDetailsStore) => {
    // @store 适配器：将子任务 store 适配为 TaskUseCase 所需的 TaskStore 接口
    const subTaskStore: TaskStore = {
        setTasks: (tasks) => taskDetailsStore.setSubTasks(tasks),
        updateTask: (id, update) => taskDetailsStore.updateSubTask(id, update),
        addTask: (task) => taskDetailsStore.addSubTask(task),
        addTasks: (tasks) => taskDetailsStore.addSubTasks(tasks),
        getTask: (id) => taskDetailsStore.getSubTask(id),
        removeTask: (id) => taskDetailsStore.removeSubTask(id)
    }

    // @usecase 独立于主任务列表的子任务用例
    const subTaskUseCase = newTaskUseCase(subTaskStore)

    // @loader 子任务加载器
    const subTaskLoader = useTasksLoader(subTaskUseCase, { limit: 20 })

    // @state 子任务列表
    const subTasks = computed(() =>
        [...subTaskLoader.states.taskIds]
            .map((taskId) => taskDetailsStore.getSubTask(taskId)!)
            .filter(Boolean)
    )

    const subTasksLoading = computed(() => taskDetailsStore.subTasksLoading)
    const subTasksError = computed(() => taskDetailsStore.subTasksError)

    // @state 当前父任务 ID
    let currentParentTaskId: TaskViewObject['id'] | null = null

    /**
     * 加载子任务
     * @param taskId 父任务 ID
     */
    const loadSubTasks = async (taskId: TaskViewObject['id']) => {
        currentParentTaskId = taskId
        taskDetailsStore.setSubTasksLoading(true)
        taskDetailsStore.setSubTasksError('')
        subTaskLoader.states.taskIds.clear()
        subTaskLoader.states.pagination.page = 1
        subTaskLoader.states.isDone = false
        subTaskLoader.states.disabled = false
        const [taskIds, err] = await subTaskLoader.load({ parentTaskId: taskId })
        if (err !== null) {
            taskDetailsStore.setSubTasksError('子任务获取失败：' + unwrapError(err))
        } else if (taskIds) {
            taskIds.forEach((id) => subTaskLoader.states.taskIds.add(id))
        }
        taskDetailsStore.setSubTasksLoading(false)
    }

    /**
     * 重试加载子任务
     */
    const retrySubTasks = async () => {
        if (!currentParentTaskId) return
        await loadSubTasks(currentParentTaskId)
    }

    // @returns
    return {
        subTaskUseCase,
        subTasks,
        subTasksLoading,
        subTasksError,
        loadSubTasks,
        retrySubTasks
    }
}

export default useSubTasks

