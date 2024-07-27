<template>
    <nue-container class="kanban-column">
        <nue-header class="kanban-column__header">
            <todo-state-info :state="category"></todo-state-info>
            <nue-text size="12px" color="gray">{{ todos.length }}</nue-text>
        </nue-header>
        <nue-main class="kanban-column__main">
            <empty :empty="!todos.length" message="没有数据。"></empty>
            <todo-card
                v-for="todo in todos"
                :key="todo.id"
                :todo="todo"
                :actived="todo.id === currentTaskId"
                @click="handleShowTodoDetails"
                @delete="(todoId) => emit('delete-todo', todoId)"
                @unfinish="(todoId) => emit('unfinish-todo', todoId)"
                @finish="(todoId) => emit('finish-todo', todoId)"
                @heart="(todoId) => emit('heart-todo', todoId)"
            ></todo-card>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { TodoCard, TodoStateInfo, Empty } from '@/components'
import type { Todo } from '@/stores'

const props = defineProps<{
    category: string
    todos: Todo[]
}>()
const emit = defineEmits<{
    (event: 'show-todo-details', todoId: Todo['id']): void
    (event: 'delete-todo', todoId: Todo['id']): void
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

<style scoped>
@import url('./kanban-column.css');
</style>
