<template>
    <nue-container id="tasks/basic/kanban" theme="vertical,inner" class="content-kanban">
        <nue-header height="auto" :key="$route.path" style="box-sizing: border-box">
            <nue-div align="start" justify="space-between" gap="16px">
                <todo-filter-bar
                    :count-info="getOverview.countInfo"
                    :filter-info="getOptions"
                    @filter="handleFilter"
                />
                <nue-div justify="end" flex="none" width="fit-content" gap="12px">
                    <nue-button
                        v-if="!disabledCreateTodo"
                        theme="small,primary"
                        icon="plus-circle"
                        @click="handleAddTodo"
                    >
                        新增
                    </nue-button>
                    <list-column-switcher v-model="todoStore.columnOptions" />
                    <nue-button
                        theme="small"
                        icon="refresh"
                        @click="handleRefresh"
                        :loading="kanbanLoading || !!refreshTimer"
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
                        :todos="value"
                        :data-category="key"
                        :columns="todoStore.columnOptions"
                        data-droppable="true"
                        @show-todo-details="handleShowTodoDetails"
                        @delete-todo="removeTodoWithConfirm"
                        @restore-todo="restoreTodoWithConfirm"
                        @finish-todo="handleFinishTodo"
                        @unfinish-todo="handleUnfinishTodo"
                        @dragstart="handleDragStart"
                        @dragenter="handleDragEnter"
                        @dragover="handleDragOver"
                        @dragend="handleDragEnd"
                        @drop="handleDrop"
                    />
                </template>
            </template>
        </nue-main>
    </nue-container>
    <todo-create-dialog ref="todoCreateDialogRef" :handler="handleCreateTodo" />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { Loading, TodoFilterBar, ListColumnSwitcher, TodoCreateDialog } from '@nao-todo/components'
import { ContentKanbanColumn } from './kanban-column'
import { useTodoStore } from '@/stores'
import {
    createTodoWithOptions,
    removeTodoWithConfirm,
    restoreTodoWithConfirm,
    updateTodoWithCompare
} from '@/handlers/todo-handlers'
import type { ContentKanbanProps, ContentKanbanEmits } from './types'
import type { Todo, GetTodosOptions } from '@nao-todo/types'

const props = defineProps<ContentKanbanProps>()
const emit = defineEmits<ContentKanbanEmits>()

const router = useRouter()
const todoStore = useTodoStore()

const { todos, getOptions, getOverview } = storeToRefs(todoStore)

const kanbanLoading = ref(false)
const refreshTimer = ref<number | null>(null)
const draggingTodoId = ref('abc')
const todoCreateDialogRef = ref<InstanceType<typeof TodoCreateDialog>>()

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

const handleGetTodos = async () => {
    const { filterInfo } = props
    kanbanLoading.value = true
    await handleFilter(filterInfo)
    kanbanLoading.value = false
}

const handleShowTodoDetails = (todoId: Todo['id']) => {
    const { baseRoute } = props
    router.push({
        name: baseRoute,
        params: { taskId: todoId }
    })
}

const handleAddTodo = () => {
    if (!todoCreateDialogRef.value) return
    emit('createTodoByDialog', todoCreateDialogRef.value.show)
}

const handleCreateTodo = async (newTodo: Partial<Todo>) => {
    return await createTodoWithOptions(newTodo.projectId || null, newTodo)
}

const handleFilter = async (newTodoFliter: GetTodosOptions) => {
    todoStore.updateGetOptions(newTodoFliter)
    await todoStore.doGetTodos()
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
    await updateTodoWithCompare(todoId, { state: category as Todo['state'] })
}

handleGetTodos()
</script>

<style scoped>
@import url('./kanban.css');
</style>
