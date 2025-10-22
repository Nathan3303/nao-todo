import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useTasksDataStore, useTasksViewStore } from '@/stores/tasks'
import { useRefreshKey } from './use-refresh-key'
import { debounce, isExpired, unwrapError } from '@nao-todo/utils'
import type { Todo } from '@nao-todo/types'
import type { TodoListEmits, TodoListMultiSelectPayload, TodoListProps } from './types'

export const useTodoList = (props: TodoListProps, emit: TodoListEmits) => {
    // @stores
    const route = useRoute()
    const tasksDataStore = useTasksDataStore()
    const tasksViewStore = useTasksViewStore()

    // @hook useRefreshKey
    const { refreshKey, startRefresh, stopRefresh } = useRefreshKey()

    // @states 前置状态
    const { todos, tags } = storeToRefs(tasksDataStore)
    const { viewProps } = storeToRefs(tasksViewStore)

    // @state 分页信息
    const page = ref<number>(1)

    // @states 加载态以及加载失败错误信息
    const loading = ref<boolean>(true)
    const error = ref<string>('')

    // @state 滚动加载禁用状态
    const infiniteScrollDisabled = ref<boolean>(false)

    // @method 加载待办任务数据
    const getTodos = async (useLoading: boolean = false): Promise<boolean> => {
        // 判断 viewProps 是否存在
        if (!viewProps.value) return false
        // 重置加载状态
        loading.value = useLoading && true
        // 调用 API 请求数据
        const [count, err] = await tasksDataStore.getTodosWithPush({
            ...props.extraGetOptions,
            ...viewProps.value.preference.getTodosOptions,
            page: page.value,
            limit: 20
        })
        loading.value = useLoading && false
        // 处理失败结果
        if (err) {
            error.value = unwrapError(err)
            return false
        }
        // 处理当待办任务为空时的情况
        if (todos.value.length === 0) {
            error.value = '暂无待办任务'
            return false
        }
        // 处理成功结果
        error.value = ''
        if (page.value === 1 && todos.value.length) activeRowByTodoIdFromRoute()
        page.value++
        infiniteScrollDisabled.value = !count || count < 20
        return true
    }

    // @watch 当请求 ID 变化时重新获取待办数据 - 用于路由参数变化时
    // watch(
    //     () => viewProps.value?.id,
    //     async () => {
    //         await getTodos(true)
    //         if (todos.value.length) activeRowByTodoIdFromRoute()
    //     },
    //     { immediate: true }
    // )

    // @watch 当相关数据变化时获取待办任务数据
    watch(
        () => viewProps.value?.preference.getTodosOptions,
        () => getTodos(),
        { deep: true }
    )

    // @computed 计算标签显示数量 - 用于响应式变化时变化标签显示个数
    const tagBarClamped = computed(() => {
        if (!props.columns) return 2
        let trueCount = 0
        Object.keys(props.columns).forEach((key: string) => {
            if (props.columns[key as keyof TodoListProps['columns']]) {
                trueCount++
            }
        })
        return Math.max(Math.ceil(5 / trueCount), 2)
    })

    // @method 检测当前待办任务是否过期
    const isTodoExpired = (todo: Todo) => {
        return isExpired(todo.endAt || '') && todo.state !== 'done'
    }

    // @state 正在查看的待办任务 Id 记录 - 用于高量任务行
    const selectedId = ref<Todo['id']>()

    // @method 显示待办详情
    const showTodoDetailsPanel = (todoId: Todo['id'], idx: number) => {
        // 记录当前待办 ID
        selectedId.value = todoId
        // 恢复多选参数 - 取消多选
        selectRange.original = selectRange.start = selectRange.end = idx
        // 显示详情
        emit('showTodoDetails', todoId)
    }

    // @state 多行选择范围记录 - 用于多行选择
    const selectRange = reactive<TodoListMultiSelectPayload['selectRange']>({
        start: -1,
        end: -1,
        original: -1
    })

    // @method 多选待办处理
    const showMultiSelectPanel = (idx: number) => {
        if (selectRange.original === -1 || selectRange.original === idx) return
        if (selectRange.original > idx) {
            selectRange.start = idx
            selectRange.end = selectRange.original
        } else {
            selectRange.start = selectRange.original
            selectRange.end = idx
        }
        const selectedIds = props.todos
            .slice(selectRange.start, selectRange.end + 1)
            .map((todo) => todo.id)
        emit('showMultiSelect', { selectedIds, selectRange })
        handleClearSelectedId()
    }

    // @method 清除待办选择
    const handleClearSelectedId = () => {
        if (props.simple) return
        selectedId.value = void 0
    }

    // @method 清空多选范围
    const handleClearSelect = (fullClear: boolean = false) => {
        handleClearSelectedId()
        if (fullClear) selectRange.original = -1
        selectRange.start = selectRange.original
        selectRange.end = selectRange.original
    }

    // @methods 删除功能按钮点击处理 - 当待办任务删除时则处理恢复动作，相反则处理删除动作（非硬删除）
    const deleteButtonClickHandler = (todoId: Todo['id'], isDeleted: boolean) => {
        if (isDeleted) {
            emit('restoreTodo', todoId)
        } else {
            emit('deleteTodo', todoId)
        }
    }

    // @methods 根据路由中的待办 ID 获取表格下标 / 根据路由中的待办 ID 激活表格项
    const activeRowByTodoIdFromRoute = () => {
        // activeRowByTodoIdFromRoute()
        const idx = props.todos.findIndex((todo) => todo.id === (route.params.todoId as string))
        if (idx === -1) return
        handleClearSelect(true)
        // selectedId.value = props.todos[idx].id
        showTodoDetailsPanel(props.todos[idx].id, idx)
    }

    // @returns
    return {
        selectedId,
        selectRange,
        tagBarClamped,
        todos,
        tags,
        loading,
        error,
        page,
        refreshKey,
        infiniteScrollDisabled,
        getTodos,
        loadMore: debounce(() => getTodos(true), 128),
        isTodoExpired,
        showTodoDetailsPanel,
        showMultiSelectPanel,
        handleClearSelectedId,
        handleClearSelect,
        deleteButtonClickHandler,
        getProjectName: tasksDataStore.getProjectNameById,
        startRefresh,
        stopRefresh,
        getColumnText: tasksViewStore.getColumnText,
        activeRowByTodoIdFromRoute,
        clearTodos: tasksDataStore.clearTodos
    }
}
