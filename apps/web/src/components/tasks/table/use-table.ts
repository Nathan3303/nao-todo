import { computed, reactive, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { isExpired } from '@nao-todo/utils'
import { useProjectStore } from '@/stores/global'
import type { Todo } from '@nao-todo/types'
import type { TodoTableEmits, TodoTableMultiSelectPayload, TodoTableProps } from './types'

export const useTodoTable = (props: TodoTableProps, emit: TodoTableEmits) => {
    // @stores
    const route = useRoute()
    const projectStore = useProjectStore()

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

    // @method 查找清单名称
    const getProjectNameByIdFromLocal = (projectId: string) => {
        const targetProject = projectStore.projects.find((p) => p.id === projectId)
        if (!targetProject) return
        return targetProject.name
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
    onMounted(() => {
        // activeRowByTodoIdFromRoute()
        const idx = props.todos.findIndex((todo) => todo.id === (route.params.todoId as string))
        if (idx === -1) return
        handleClearSelect(true)
        // selectedId.value = props.todos[idx].id
        showTodoDetailsPanel(props.todos[idx].id, idx)
    })

    // @returns
    return {
        selectedId,
        selectRange,
        tagBarClamped,
        isTodoExpired,
        showTodoDetailsPanel,
        showMultiSelectPanel,
        handleClearSelectedId,
        handleClearSelect,
        getProjectNameByIdFromLocal,
        deleteButtonClickHandler
    }
}
