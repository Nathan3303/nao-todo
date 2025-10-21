import { computed, ref, inject, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTasksViewStore } from '@/stores/tasks'
import { debounce } from '@nao-todo/utils'
import { TODO_KANBAN_CONTEXT_KEY } from './constants'
import type { TodoKanbanColumnEmits, TodoKanbanColumnProps, TodoKanbanContext } from './types'
import type { GetTodosOptions } from '@nao-todo/types'

export const useColumnLoader = (props: TodoKanbanColumnProps, emit: TodoKanbanColumnEmits) => {
    // @stores 全局 stores
    const tasksViewStore = useTasksViewStore()

    // @inject 看板组件上下文
    const todoKanbanContext = inject<TodoKanbanContext>(TODO_KANBAN_CONTEXT_KEY)

    // @states 前置状态
    const { viewProps } = storeToRefs(tasksViewStore)

    // @state 分页信息
    const page = ref<number>(1)

    // @state 加载状态
    const loading = ref(false)

    // @state 加载完成状态
    const loadCompleted = ref(false)

    // @computed 禁用状态
    const disabled = computed(() => {
        const state = viewProps.value?.preference.getTodosOptions.state
        return state && !state.includes(props.category)
    })

    // @computed 筛选后的待办任务列表
    const filteredTodos = computed(() => {
        if (!todoKanbanContext || disabled.value) return []
        return todoKanbanContext.todos.value.filter((todo) => todo.state === props.category)
    })

    // @computeds 错误状态以及信息
    const error = computed(() => !filteredTodos.value.length || disabled.value)
    const errorMessage = computed(() => {
        if (disabled.value) return '根据筛选规则，当前列暂无待办任务'
        return '暂无待办任务'
    })

    // @computed 标签列表 - 消除 inject 为空的情况
    const tags = computed(() => {
        if (!todoKanbanContext) return []
        return todoKanbanContext.tags.value
    })

    // @method 获取待办任务列表
    const getTodos = (useLoading: boolean = false) => {
        // 判断组件上下文是否存在
        if (!todoKanbanContext) return
        // 判断是否由于筛选而禁用
        if (disabled.value) return
        // 判断是否正在加载
        if (loading.value) return
        // 判断是否加载完毕
        if (loadCompleted.value) return
        // 构建请求参数
        const getOptions: GetTodosOptions = {
            page: page.value,
            limit: 20,
            ...(viewProps.value?.preference.getTodosOptions ?? {}),
            state: props.category
        }
        // 请求数据
        loading.value = useLoading && true
        todoKanbanContext
            .getTodosWithPush(getOptions)
            .then(([count, err]) => {
                // 处理失败结果
                if (err) {
                    console.error(
                        '[UseColumnLoader/GetTodos]',
                        `Column '${props.category}' failed to get todos:`,
                        err
                    )
                    return
                }
                // 处理成功结果
                page.value++
                loadCompleted.value = !count
            })
            .finally(() => (loading.value = useLoading && false))
    }

    // @method 获取待办任务列表防抖版本
    const getTodosDebounce = debounce(getTodos, 128)

    // @watch 当请求 ID 变化时重新获取待办数据 - 用于路由参数变化时
    watch(
        () => viewProps.value?.id,
        () => getTodosDebounce(true)
    )

    // @watch 当相关数据变化时获取待办任务数据
    watch(
        () => viewProps.value?.preference.getTodosOptions,
        () => {
            __resetStates()
            getTodosDebounce()
        },
        { deep: true }
    )

    // @method 重置所有状态
    const __resetStates = () => {
        // 重置所有状态
        page.value = 1
        loading.value = false
        loadCompleted.value = false
        // 移除当前列的任务
        emit('filter-todos-by-category', props.category)
    }

    // @returns
    return {
        todos: filteredTodos,
        tags,
        loading,
        loadCompleted,
        disabled,
        error,
        errorMessage,
        loadMore: getTodosDebounce,
        __resetStates
    }
}
