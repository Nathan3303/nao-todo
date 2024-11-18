<template>
    <nue-container id="tasks/basic/kanban" class="content-kanban" theme="vertical,inner">
        <nue-header :key="$route.path" height="auto" style="box-sizing: border-box">
            <nue-div align="start" gap="16px" justify="space-between">
                <todo-filter-bar :filter-options="todoFilterBarOptions" @filter="handleFilter" />
                <nue-div flex="none" gap="12px" justify="end" width="fit-content">
                    <nue-button
                        v-if="!disabledCreateTodo"
                        icon="plus-circle"
                        theme="small,primary"
                        @click="showCreateTodoDialog"
                    >
                        新增
                    </nue-button>
                    <todo-table-column-selector v-model="todoStore.columnOptions" :change="handleChangeColumns" />
                    <nue-button
                        :loading="kanbanLoading || !!refreshTimer"
                        icon="refresh"
                        theme="small"
                        @click="handleRefresh"
                    />
                </nue-div>
            </nue-div>
        </nue-header>
        <nue-main style="border: none">
            <Loading v-if="kanbanLoading" placeholder="正在加载任务看板..." />
            <template v-else>
                <template v-for="(value, key) in categoriedTodos" :key="key">
                    <content-kanban-column
                        :category="key"
                        :columnOptions="todoStore.columnOptions"
                        :data-category="key"
                        :todos="value"
                        data-droppable="true"
                        @dragend="handleDragEnd"
                        @dragenter="handleDragEnter"
                        @dragover="handleDragOver"
                        @dragstart="handleDragStart"
                        @drop="handleDrop"
                        @show-todo-details="showTodoDetails"
                        @delete-todo="todoStore.deleteTodoWithConfirmation"
                        @restore-todo="todoStore.restoreTodoWithConfirmation"
                        @finish-todo="handleFinishTodo"
                        @unfinish-todo="handleUnfinishTodo"
                    />
                </template>
            </template>
        </nue-main>
    </nue-container>
    <create-todo-dialog ref="todoCreateDialogRef" :handler="todoStore.doCreateTodo" />
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { Loading, TodoFilterBar } from '@nao-todo/components'
import { ContentKanbanColumn } from './kanban-column'
import { CreateTodoDialog, TodoTableColumnSelector } from '@/layers'
import { useTodoStore } from '@/stores'
import type { CreateTodoDialogCallerArgs } from '@/layers/create-todo-dialog/types'
import type { GetTodosOptions, Todo, TodoColumnOptions } from '@nao-todo/types'
import type { TodoFilterOptions } from '@nao-todo/components/todo/filter-bar/types'

const props = defineProps<{
    baseRoute: string
    disabledCreateTodo?: boolean
}>()
const emit = defineEmits<{
    (event: 'createTodo', newTodoName: string): void
    (event: 'createTodoByDialog', caller: (args: CreateTodoDialogCallerArgs) => void): void
}>()

const router = useRouter()
const todoStore = useTodoStore()

const { todos, getOptions } = storeToRefs(todoStore)

const kanbanLoading = ref(false)
const refreshTimer = ref<number | null>(null)
const draggingTodoId = ref('abc')
const todoCreateDialogRef = ref<InstanceType<typeof CreateTodoDialog>>()

// 计算 TodoFilterBar 的过滤选项
const todoFilterBarOptions = computed<TodoFilterOptions>(() => {
    return {
        name: getOptions.value.name || '',
        state: getOptions.value.state || '',
        priority: getOptions.value.priority || ''
    }
})

const categoriedTodos = computed(() => {
    const result: { [key in Todo['state']]: Todo[] } = {
        todo: [],
        'in-progress': [],
        done: []
    }
    for (const todo of todos.value) {
        result[todo.state].push(todo)
    }
    return result
})

const showTodoDetails = (todoId: Todo['id']) => {
    const { baseRoute } = props
    router.push({
        name: baseRoute,
        params: { taskId: todoId }
    })
}

const showCreateTodoDialog = () => {
    if (!todoCreateDialogRef.value) return
    emit('createTodoByDialog', todoCreateDialogRef.value.show)
}

const handleGetTodos = async () => {
    kanbanLoading.value = true
    await todoStore.doGetTodos()
    kanbanLoading.value = false
}
handleGetTodos()

// 处理筛选
const handleFilter = async (newTodoFilter: TodoFilterOptions) => {
    const options: GetTodosOptions = { ...getOptions.value }
    Object.keys(newTodoFilter).forEach((key) => {
        const _k = key as keyof TodoFilterOptions
        if (newTodoFilter[_k]) {
            options[_k] = newTodoFilter[_k]
        } else if (Object.prototype.hasOwnProperty.call(options, _k)) {
            delete options[_k]
        }
    })
    todoStore.updateGetOptions(options)
    await todoStore.doGetTodos()
}

const handleChangeColumns = (options: TodoColumnOptions) => {
    todoStore.updateColumnOptions(options)
}

const handleRefresh = async () => {
    if (refreshTimer.value) return
    await handleGetTodos()
}

const handleFinishTodo = async (todoId: Todo['id']) => {
    await todoStore.doUpdateTodo(todoId, { state: 'done' })
}

const handleUnfinishTodo = async (todoId: Todo['id']) => {
    await todoStore.doUpdateTodo(todoId, { state: 'todo' })
}

const handleDragStart = (event: DragEvent) => {
    const target = event.target as HTMLElement
    draggingTodoId.value = target.dataset.todoid as string
}

const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer!.dropEffect = 'move'
}

const handleRemoveDragOverClass = () => {
    document.querySelectorAll('.kanban-column__main--drag-over').forEach((element) => {
        element.classList.remove('kanban-column__main--drag-over')
    })
}

const getDropNode = (node: HTMLElement) => {
    while (node) {
        if (node.dataset.droppable === 'true') {
            return node
        }
        if (node.parentNode) {
            node = node.parentNode as HTMLElement
        }
    }
}

const getTargetNode = (node: HTMLElement) => {
    while (node) {
        if (node.dataset.category) {
            return node
        }
        if (node.parentNode) {
            node = node.parentNode as HTMLElement
        }
    }
}

const handleDragEnter = (event: DragEvent) => {
    event.preventDefault()
    handleRemoveDragOverClass()
    const element = getDropNode(event.target as HTMLElement)
    if (element && element.dataset.droppable === 'true') {
        element.classList.add('kanban-column__main--drag-over')
    }
}

const handleDragEnd = () => {
    handleRemoveDragOverClass()
}

const handleDrop = async (event: DragEvent) => {
    handleRemoveDragOverClass()
    const element = getTargetNode(event.target as HTMLElement)
    if (!element) return
    const category = element.dataset.category as string
    if (!category) return
    const todoId = draggingTodoId.value
    const todo = todoStore.getTodoByIdFromLocal(todoId)
    if (todo && todo.state === category) return
    await todoStore.doUpdateTodo(todoId, { state: category as Todo['state'] })
}
</script>

<style scoped>
.content-kanban {
    width: 100%;

    & > .nue-header {
        border-bottom: none;
        padding-top: 8px;
    }

    & > .nue-main {
        overflow: hidden;
        overflow-x: auto;
        gap: 16px;

        &:deep(> .nue-main__content) {
            flex-direction: row;
            padding: 0 16px;
            gap: 16px;
        }
    }
}

</style>
