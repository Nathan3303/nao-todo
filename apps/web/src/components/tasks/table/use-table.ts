import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useTasksDataStore, useTasksViewStore } from '@/stores/tasks'
import { useRefreshKey } from './use-refresh-key'
import { isExpired, unwrapError } from '@nao-todo/utils'
import type { Todo } from '@nao-todo/types'
import type { TodoTableEmits, TodoTableMultiSelectPayload, TodoTableProps } from './types'

export const useTodoTable = (props: TodoTableProps, emit: TodoTableEmits) => {
    // @stores
    const route = useRoute()
    const tasksDataStore = useTasksDataStore()
    const tasksViewStore = useTasksViewStore()

    // @hook useRefreshKey
    const { refreshKey, startRefresh, stopRefresh } = useRefreshKey()

    // @states 前置状态
    const { todos, pagination, tags } = storeToRefs(tasksDataStore)
    const { viewProps } = storeToRefs(tasksViewStore)

    // @state 分页信息
    const page = ref<number>(1)

    // @states 加载态以及加载失败错误信息
    const loading = ref<boolean>(true)
    const error = ref<string>('')

    // @method 加载待办任务数据
    const getTodos = async (useLoading: boolean = false): Promise<boolean> => {
        // 判断 viewProps 是否存在
        if (!viewProps.value) return false
        // 重置加载状态
        loading.value = useLoading && true
        // 调用 API 请求数据
        const err = await tasksDataStore.getTodos({
            page: page.value,
            limit: 20,
            ...props.extraGetOptions,
            ...viewProps.value.preference.getTodosOptions
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
        return true
    }

    // @watch 当请求 ID 变化时重新获取待办数据 - 用于路由参数变化时
    watch(
        () => viewProps.value?.id,
        async () => {
            await getTodos(true)
            if (todos.value.length) activeRowByTodoIdFromRoute()
        },
        { immediate: true }
    )

    // @watch 当相关数据变化时获取待办任务数据
    watch(
        () => viewProps.value?.preference.getTodosOptions,
        () => getTodos(),
        { deep: true }
    )

    // @computed 计算标签显示数量 - 用于响应式变化时变化标签显示个数
    const tagBarClamped = computed(() => {
        if (!props.columnOptions) return 2
        let trueCount = 0
        Object.keys(props.columnOptions).forEach((key: string) => {
            if (props.columnOptions[key as keyof TodoTableProps['columnOptions']]) {
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
    const selectRange = reactive<TodoTableMultiSelectPayload['selectRange']>({
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

    // @method 处理分页每页记录数变化
    const handleUpdatePerPage = (limit: number) => {
        if (!viewProps.value) return
        viewProps.value.preference.getTodosOptions.limit = limit
        page.value = 1
        getTodos()
    }

    // @method 处理分页页码变化
    const handleUpdatePage = (newPage: number) => {
        page.value = newPage
        getTodos()
    }

    // @method 重新加载待办任务数据
    const resetAndGetTodos = async (): Promise<boolean> => {
        page.value = 1
        tasksDataStore.clearTodos()
        return getTodos(true)
    }

    // @returns
    return {
        selectedId,
        selectRange,
        tagBarClamped,
        todos,
        pagination,
        tags,
        loading,
        error,
        page,
        // tableMinWidth,
        refreshKey,
        getTodos,
        isTodoExpired,
        showTodoDetailsPanel,
        showMultiSelectPanel,
        handleClearSelectedId,
        handleClearSelect,
        handleUpdatePerPage,
        handleUpdatePage,
        deleteButtonClickHandler,
        getProjectName: tasksDataStore.getProjectNameById,
        startRefresh,
        stopRefresh,
        getColumnText: tasksViewStore.getColumnText,
        resetAndGetTodos
    }
}

