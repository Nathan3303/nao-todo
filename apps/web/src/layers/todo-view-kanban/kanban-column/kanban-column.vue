<template>
    <nue-container class="kanban-column" theme="vertical,inner">
        <nue-header class="kanban-column__header" height="32px" style="box-sizing: border-box">
            <todo-state-info :state="category" />
            <nue-text color="gray" size="var(--text-sm)">{{ todos.length }}</nue-text>
        </nue-header>
        <nue-main class="kanban-column__main" style="border: none">
            <empty :empty="!todos.length" message="没有待办任务" />
            <todo-card
                v-for="todo in todos"
                :key="todo.id"
                :actived="todo.id === currentTaskId"
                :columns="columnOptions"
                :data-todoId="todo.id"
                :todo="todo"
                draggable="true"
                @click="handleShowTodoDetails"
                @delete="(todoId) => emit('delete-todo', todoId)"
                @finish="(todoId) => emit('finish-todo', todoId)"
                @heart="(todoId) => emit('heart-todo', todoId)"
                @restore="(todoId) => emit('restore-todo', todoId)"
                @unfinish="(todoId) => emit('unfinish-todo', todoId)"
            />
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { TodoCard } from '@/layers'
import { Empty, TodoStateInfo } from '@nao-todo/components'
import type { Todo, TodoColumnOptions } from '@nao-todo/types'
import './kanban-column.css'

defineProps<{
    category: Todo['state']
    todos: Todo[]
    columnOptions?: TodoColumnOptions
}>()
const emit = defineEmits<{
    (event: 'show-todo-details', todoId: Todo['id']): void
    (event: 'delete-todo', todoId: Todo['id']): void
    (event: 'restore-todo', todoId: Todo['id']): void
    (event: 'finish-todo', todoId: Todo['id']): void
    (event: 'unfinish-todo', todoId: Todo['id']): void
    (event: 'heart-todo', todoId: Todo['id']): void
}>()

const route = useRoute()

const currentTaskId = computed(() => {
    return (route.params.taskId as Todo['id']) || ''
})

const handleShowTodoDetails = (todoId: Todo['id']) => {
    emit('show-todo-details', todoId)
}
</script>
