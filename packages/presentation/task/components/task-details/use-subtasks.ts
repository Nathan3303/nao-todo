import { type GoAsync, unwrapError } from '@nao-todo/shared'
import dayjs from 'dayjs'
import { computed, inject } from 'vue'
import { useTasksLoader } from '../../hooks'
import type { useTaskDetailsStore } from '../../stores'
import type { TaskViewObject } from '../../types'
import { TASK_DETAILS_PRE_CONTEXT_KEY } from './context'

/**
 * 子任务加载器 composable
 * @description 复用 useTasksLoader，以 parentTaskId 为条件加载子任务，
 *              并将数据写入 TaskDetailsStore 中独立的子任务 store（与主任务列表隔离）。
 * @param taskDetailsStore 任务详情存储
 */
const useSubTasks = (taskDetailsStore: ReturnType<typeof useTaskDetailsStore>) => {
    // @context 任务详情上下文
    const { subTaskUseCase } = inject(TASK_DETAILS_PRE_CONTEXT_KEY)!

    // @store 适配器：将子任务 store 适配为 TaskUseCase 所需的 TaskStore 接口
    // const subTaskStore: TaskStore = {
    //     setTasks: (tasks) => taskDetailsStore.setSubTasks(tasks),
    //     updateTask: (id, update) => taskDetailsStore.updateSubTask(id, update),
    //     addTask: (task) => taskDetailsStore.addSubTask(task),
    //     addTasks: (tasks) => taskDetailsStore.addSubTasks(tasks),
    //     getTask: (id) => taskDetailsStore.getSubTask(id),
    //     removeTask: (id) => taskDetailsStore.removeSubTask(id)
    // }

    // @loader 子任务加载器
    const subTaskLoader = useTasksLoader(subTaskUseCase, { limit: 20 })

    // @state 子任务列表
    const subTasks = computed(() =>
        [...subTaskLoader.states.taskIds]
            .map((taskId) => taskDetailsStore.getSubTask(taskId)!)
            .filter(Boolean)
    )

    // @state 子任务加载&错误状态
    const subTasksLoading = computed(() => taskDetailsStore.subTasksLoading)
    const subTasksError = computed(() => taskDetailsStore.subTasksError)

    // @state 子任务完成进度
    const subTaskProgress = computed(() => {
        const progress = subTasks.value.filter((subTask) => subTask.state === 'done').length
        const total = subTasks.value.length
        const percentage = total ? Math.floor((progress / total) * 100) : 0
        const text = total ? `已完成 ${progress}/${total}, ${percentage}%` : '暂无子任务'
        return { percentage, text }
    })

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

    /**
     * 创建子任务
     * @description 以当前父任务 ID 创建子任务，成功后将新任务 ID 追加到加载器列表，
     *              使其即时展示于子任务列表末尾。
     * @param name 子任务名称
     */
    const createSubTask = async (name: TaskViewObject['name']): GoAsync<void> => {
        if (!currentParentTaskId) return '缺少父任务 ID'
        const [task, err] = await subTaskUseCase.create({
            parentTaskId: currentParentTaskId,
            projectId: null,
            name,
            description: '',
            state: 'todo',
            priority: 'low',
            startAt: null,
            endAt: dayjs().toISOString(),
            tags: [],
            remindAt: null,
            remindRepeat: 'none',
            remindTime: null,
            remindWeekdays: []
        })
        if (err !== null) return err
        subTaskLoader.states.taskIds.add(task.id)
        return null
    }

    // @returns
    return {
        subTaskUseCase,
        subTasks,
        subTasksLoading,
        subTasksError,
        subTaskProgress,
        loadSubTasks,
        retrySubTasks,
        createSubTask
    }
}

export default useSubTasks
