<template>
    <nue-container theme="vertical,inner" class="kanban-column">
        <nue-header height="32px" class="kanban-column__header" style="box-sizing: border-box">
            <todo-state-info :state="category"></todo-state-info>
            <nue-text size="12px" color="gray">{{ todos.length }}</nue-text>
        </nue-header>
        <nue-main class="kanban-column__main" style="border: none">
            <empty :empty="!todos.length" message="没有数据。"></empty>
            <todo-card
                v-for="todo in todos"
                :key="todo.id"
                :todo="todo"
                :actived="todo.id === currentTaskId"
                :data-todoId="todo.id"
                :columns="columns"
                draggable="true"
                @click="handleShowTodoDetails"
                @delete="(todoId) => emit('delete-todo', todoId)"
                @restore="(todoId) => emit('restore-todo', todoId)"
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
import { TodoCard } from '@/layers'
import { TodoStateInfo, Empty } from '@nao-todo/components'
import type { Todo } from '@nao-todo/types'
import type { KanbanColumnProps, KanbanColumnEmits } from './types'

defineProps<KanbanColumnProps>()
const emit = defineEmits<KanbanColumnEmits>()

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
