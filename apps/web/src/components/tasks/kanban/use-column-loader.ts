import { computed, ref, shallowReactive } from 'vue'
import { storeToRefs } from 'pinia'
import { useTasksBasicViewStore, useTasksViewStore } from '@/stores/tasks'
import useKanbanStore from './use-kanban-store'
import { debounce } from '@nao-todo/utils'
import type { GetTodosOptions } from '@nao-todo/types'
import type { KanbanColumnProps } from './types'

export const useColumnLoader = (props: KanbanColumnProps) => {
    // @stores 全局 stores
    const tasksViewStore = useTasksViewStore()
    const tasksBasicViewStore = useTasksBasicViewStore()
    const kanbanStore = useKanbanStore()

    // @states 前置状态
    const { todos, tags } = storeToRefs(kanbanStore)
    const { viewProps } = storeToRefs(tasksViewStore)

    // @state 分页状态
    const pageInfo = shallowReactive({ page: 1, limit: 20 })

    // @state 加载状态
    const loading = ref(false)

    // @state 加载完成状态
    const isAllLoaded = ref(false)

    // @state 首次加载状态
    const isTheFirstLoading = ref(true)

    // @computed 禁用状态
    const isDisabled = computed(() => {
        const stateInOriginalGetOptions = viewProps.value?.preference.getTodosOptions.state ?? ''
        return stateInOriginalGetOptions && !stateInOriginalGetOptions.includes(props.category)
    })

    // @computed 筛选后的待办任务列表
    const filteredTodos = computed(() => {
        return todos.value.filter((todo) => todo.state === props.category)
    })

    // @method 获取待办任务列表
    const getTodos = async () => {
        if (isDisabled.value) return
        if (loading.value && isAllLoaded.value) return
        const getOptions: GetTodosOptions = {
            ...(viewProps.value?.preference.getTodosOptions ?? {}),
            ...pageInfo,
            state: props.category
        }
        loading.value = true
        const [count, err] = await kanbanStore.getTodosWithPush(getOptions)
        if (err) {
            console.warn(
                '[UseColumnLoader/GetTodos]',
                `Column '${props.category}' failed to get todos:`,
                err
            )
            return
        }
        pageInfo.page += 1
        isAllLoaded.value = count === 0 || count < getOptions.limit!
        isTheFirstLoading.value = false
        loading.value = false
    }

    // @returns
    return {
        todos: filteredTodos,
        tags,
        pageInfo,
        loading,
        isAllLoaded,
        isTheFirstLoading,
        isDisabled,
        loadMore: debounce(getTodos, 64),
        handleShowTodoDetails: tasksBasicViewStore.showTodoDetails
    }
}
