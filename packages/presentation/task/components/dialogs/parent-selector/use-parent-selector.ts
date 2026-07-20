import { unwrapError } from '@nao-todo/shared'
import { computed, reactive } from 'vue'
import { useTasksStore } from '../../../stores'
import type { TaskViewObject } from '../../../types'
import type { ParentTaskSelectorPayload, TaskParentSelectorDialogProps } from './types'

export const useParentTaskSelector = (props: TaskParentSelectorDialogProps) => {
    const tasksStore = useTasksStore()

    const states = reactive({
        loading: false,
        error: '',
        keyword: '',
        currentTaskId: '' as TaskViewObject['id'],
        selectedTaskId: '' as TaskViewObject['id'],
        taskIds: [] as TaskViewObject['id'][]
    })

    let onSelectCallback: ParentTaskSelectorPayload['onSelect'] | null = null

    // @state 候选任务列表（排除当前任务自身，并按关键字过滤）
    const tasks = computed(() => {
        const keyword = states.keyword.trim().toLowerCase()
        return states.taskIds
            .map((id) => tasksStore.getTask(id)!)
            .filter(Boolean)
            .filter((task) => task.id !== states.currentTaskId)
            .filter((task) => !keyword || task.name.toLowerCase().includes(keyword))
    })

    /**
     * 加载候选任务
     */
    const loadTasks = async () => {
        states.loading = true
        states.error = ''
        const [res, err] = await props.taskUseCase.list({
            isDeleted: false,
            isArchived: false,
            limit: 100,
            sort: { field: 'createdAt', order: 'desc' }
        })
        states.loading = false
        if (err !== null) {
            states.error = unwrapError(err)
            return
        }
        states.taskIds = res.taskIds
    }

    /**
     * 初始化选择器
     * @param payload 打开参数
     */
    const initialize = (payload: ParentTaskSelectorPayload) => {
        states.currentTaskId = payload.currentTaskId
        states.selectedTaskId = ''
        states.keyword = ''
        onSelectCallback = payload.onSelect
        loadTasks()
    }

    /**
     * 选中某个任务
     * @param taskId 任务 ID
     */
    const selectTask = (taskId: TaskViewObject['id']) => {
        states.selectedTaskId = taskId
    }

    /**
     * 确认选择
     * @returns 是否成功确认
     */
    const confirmSelect = () => {
        if (!states.selectedTaskId) return false
        onSelectCallback?.(states.selectedTaskId)
        return true
    }

    // @returns
    return { states, tasks, initialize, selectTask, confirmSelect, loadTasks }
}
