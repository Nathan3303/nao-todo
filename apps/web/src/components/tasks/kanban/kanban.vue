<script lang="ts" setup>
import { computed, provide, watchEffect } from 'vue'
import TodoKanbanColumn from './kanban-column.vue'
import useKanban from './use-kanban'
import { Loading as LoadingComponent } from '@nao-todo/components'
import { TODO_KANBAN_CONTEXT_KEY } from './constants'
import type { TodoKanbanContext, TodoKanbanEmits, TodoKanbanProps } from './types'
import './kanban.css'

defineOptions({ name: 'TodoKanban' })
defineProps<TodoKanbanProps>()
const emit = defineEmits<TodoKanbanEmits>()

// @hook useKanban
const {
    loading,
    kanbanColumns,
    todos,
    tags,
    getKanbanColumns,
    getProjectName,
    getTodosWithPush,
    handleShowTodoDetails,
    handleDeleteTodo,
    handleRestoreTodo,
    handleFinishTodo,
    handleUnfinishTodo,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragEnd,
    handleDrop,
    filterTodosByCategory
} = useKanban(emit)

// @effect
watchEffect(() => getKanbanColumns())

// @provide
provide<TodoKanbanContext>(TODO_KANBAN_CONTEXT_KEY, {
    todos: computed(() => todos.value),
    tags: computed(() => tags.value),
    getProjectName,
    getTodosWithPush
})
</script>

<template>
    <nue-container id="TodoKanbanContainer">
        <nue-main>
            <loading-component v-if="loading" placeholder="正在加载任务看板..." />
            <nue-empty
                v-else-if="kanbanColumns.length === 0"
                image-src="/images/coffee.webp"
                image-size="4rem"
                description="目前看板无分组"
            />
            <nue-content fill v-else>
                <todo-kanban-column
                    v-for="groupName in kanbanColumns"
                    :key="groupName"
                    :todos="todos"
                    :category="groupName"
                    :column-options="columnOptions"
                    :data-category="groupName"
                    @show-todo-details="handleShowTodoDetails"
                    @delete-todo="handleDeleteTodo"
                    @restore-todo="handleRestoreTodo"
                    @finish-todo="handleFinishTodo"
                    @unfinish-todo="handleUnfinishTodo"
                    data-droppable="true"
                    @dragend="handleDragEnd"
                    @dragenter="handleDragEnter"
                    @dragover="handleDragOver"
                    @dragstart="handleDragStart"
                    @drop="handleDrop"
                    @filter-todos-by-category="filterTodosByCategory"
                />
            </nue-content>
        </nue-main>
    </nue-container>
</template>
