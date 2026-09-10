import { type GoAsync, unwrapError } from '@nao-todo/shared'
import { computed, inject, ref, type Ref } from 'vue'
import { useTasksLoader } from '../../hooks'
import type { useTaskDetailsStore } from '../../stores'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { TASK_DETAILS_PRE_CONTEXT_KEY } from './context'
import type { TaskDetailsViewObject } from './types'
import { resolveSubTaskDraft } from './subtask-inheritance'

/**
 * 子任务加载器 composable
 * @description 复用 useTasksLoader，以 parentTaskId 为条件加载子任务，
 *              并将数据写入 TaskDetailsStore 中独立的子任务 store（与主任务列表隔离）。
 * @param taskDetailsStore 任务详情存储
 * @param parentTask 当前父任务详情视图对象（用于创建子任务时**快照继承** `projectId/startAt/endAt`）
 */
const useSubTasks = (
    taskDetailsStore: ReturnType<typeof useTaskDetailsStore>,
    parentTask: Ref<TaskDetailsViewObject | null>
) => {
    // @context 任务详情上下文
    const { subTaskUseCase, subscriber } = inject(TASK_DETAILS_PRE_CONTEXT_KEY)!

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

    // @state 当前父任务 ID
    const currentParentTaskId = ref<TaskViewObject['id'] | null>(null)

    // @state 子任务列表
    const subTasks = computed(() =>
        [...subTaskLoader.states.taskIds]
            .map((taskId) => taskDetailsStore.getTask(taskId)!)
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
        const text = total ? `已完成 ${progress}/${total}` : '暂无子任务'
        return { percentage, text }
    })

    /**
     * 加载子任务
     * @param taskId 父任务 ID
     */
    const loadSubTasks = async (taskId: TaskViewObject['id']) => {
        currentParentTaskId.value = taskId
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
        if (!currentParentTaskId.value) return
        await loadSubTasks(currentParentTaskId.value)
    }

    /**
     * 创建子任务
     * @description 以当前父任务 ID 创建子任务，成功后将新任务 ID 追加到加载器列表，
     *              使其即时展示于子任务列表末尾。
     *              `projectId`/`startAt`/`endAt` 由 `resolveSubTaskDraft()` 从父任务视图对象
     *              **创建时快照**继承（TASK-01 R1–R5；规则见 subtask-inheritance.ts）
     * @param name 子任务名称
     */
    const createSubTask = async (name: TaskViewObject['name']): GoAsync<void> => {
        if (!currentParentTaskId.value) return '缺少父任务 ID'
        const [task, err] = await subTaskUseCase.create(
            resolveSubTaskDraft(parentTask.value, name, currentParentTaskId.value)
        )
        if (err !== null) return err
        subTaskLoader.states.taskIds.add(task.id)
        return null
    }

    /**
     * 脱离父任务（提升为顶层任务）
     * @description 将子任务 parentTaskId 置空串并交由领域层守卫校验（'' = 解除父子，始终放行）；
     *              成功后从当前子任务列表即时移除，并触发 RefreshData 让顶层列表刷新出现该任务。
     * @param subTaskId 子任务 ID
     */
    const detachSubTask = async (subTaskId: TaskViewObject['id']): GoAsync<void> => {
        const err = await subTaskUseCase.update(subTaskId, { parentTaskId: '' })
        if (err !== null) return err
        subTaskLoader.states.taskIds.delete(subTaskId)
        subscriber.emit('RefreshData')
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
        createSubTask,
        detachSubTask
    }
}

export default useSubTasks