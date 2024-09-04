<template>
    <nue-container class="content-kanban">
        <nue-header style="padding: 0; border: none; height: fit-content" :key="$route.path">
            <nue-div align="start" justify="space-between" gap="16px">
                <todo-filter-bar
                    :count-info="countInfo"
                    :filter-info="filterInfo"
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
                    <list-column-switcher v-model="columns" :change="handleChangeColumns" />
                    <nue-button
                        theme="small"
                        icon="refresh"
                        @click="handleRefresh"
                        :loading="kanbanLoading || !!refreshTimer"
                    />
                </nue-div>
            </nue-div>
        </nue-header>
        <nue-main>
            <Loading v-if="kanbanLoading" placeholder="正在加载任务看板..." />
            <template v-else>
                <template v-for="(value, key) in categoriedTodos" :key="key">
                    <content-kanban-column
                        :category="key"
                        :todos="value"
                        :data-category="key"
                        @show-todo-details="handleShowTodoDetails"
                        @delete-todo="removeTodoWithConfirm"
                        @restore-todo="restoreTodoWithConfirm"
                        @finish-todo="handleFinishTodo"
                        @unfinish-todo="handleUnfinishTodo"
                        data-droppable="true"
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
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { Loading, TodoFilterBar, ListColumnSwitcher } from '@/components'
import { ContentKanbanColumn } from '../kanban-column'
import { useTodoStore, useUserStore, useViewStore } from '@/stores'
import { NuePrompt } from 'nue-ui'
import { removeTodoWithConfirm, restoreTodoWithConfirm } from '@/utils/todo-handlers'
import type { ContentKanbanProps, ContentKanbanEmits } from './types'
import type { Columns } from '@/components'
import type { Todo, TodoFilter } from '@/stores'

const props = defineProps<ContentKanbanProps>()
const emit = defineEmits<ContentKanbanEmits>()

const router = useRouter()
const userStore = useUserStore()
const todoStore = useTodoStore()
const viewStore = useViewStore()

const { todos, countInfo, filterInfo } = storeToRefs(todoStore)
const { user } = storeToRefs(userStore)
const kanbanLoading = ref(false)
const refreshTimer = ref<number | null>(null)
const draggingTodoId = ref('abc')
const columns = ref<Columns>(
    props.columns || {
        state: true,
        priority: true,
        project: true,
        description: true,
        endAt: true,
        createdAt: false,
        updatedAt: false
    }
)

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
    const res = await todoStore.initialize(userStore.user!.id, filterInfo)
    kanbanLoading.value = false
    return res
}

const handleShowTodoDetails = (todoId: Todo['id']) => {
    const { baseRoute } = props
    router.push({
        name: baseRoute,
        params: { taskId: todoId }
    })
}

const handleAddTodo = async () => {
    NuePrompt({
        title: '创建任务',
        placeholder: '填写任务名称',
        confirmButtonText: '创建',
        cancelButtonText: '取消',
        validator: (value: any) => value
    }).then(
        (value) => emit('createTodo', value as string),
        () => {}
    )
}

const handleFilter = async (newTodoFliter: TodoFilter) => {
    const userId = user.value!.id
    todoStore.mergeFilterInfo(newTodoFliter)
    await todoStore.get(userId)
}

const handleChangeColumns = (payload: Columns) => {
    columns.value.createdAt = payload.createdAt
    columns.value.priority = payload.priority
    columns.value.state = payload.state
    columns.value.description = payload.description
}

const handleRefresh = async () => {
    if (refreshTimer.value) return
    await handleGetTodos()
}

const handleDeleteTodo = async (todoId: Todo['id']) => {
    const userId = user.value!.id
    await todoStore.update(userId, todoId, { isDeleted: true })
}

const handleRestoreTodo = async (todoId: Todo['id']) => {
    const userId = user.value!.id
    await todoStore.update(userId, todoId, { isDeleted: false })
}

const handleFinishTodo = async (todoId: Todo['id']) => {
    const userId = user.value!.id
    await todoStore.update(userId, todoId, { state: 'done', isDone: true })
}

const handleUnfinishTodo = async (todoId: Todo['id']) => {
    const userId = user.value!.id
    await todoStore.update(userId, todoId, { isDone: false, state: 'todo' })
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

const handleDrop = (event: DragEvent) => {
    handleRemoveDragOverClass()
    const element = getTargetNode(event.target as HTMLElement)
    if (!element) return
    const category = element.dataset.category as string
    if (!category) return
    const userId = user.value!.id
    const todoId = draggingTodoId.value
    const updateInfo = { state: category as Todo['state'] }
    todoStore.update(userId, todoId, updateInfo)
}

handleGetTodos()
</script>

<style scoped>
@import url('./kanban.css');
</style>
