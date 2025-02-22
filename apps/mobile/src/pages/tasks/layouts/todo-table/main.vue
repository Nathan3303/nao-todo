<template>
    <view class="todo-table__main">
        <template v-if="todos.length">
            <todo-card
                v-for="todo in todos"
                :key="todo.id"
                :todo="todo"
                @show-todo-details="tasksViewStore.showTodoDetails"
            />
        </template>
        <template v-else>
            <nuem-empty description="该板块暂无待办任务" style="margin-top: 3rem" />
        </template>
    </view>
</template>

<script lang="ts" setup>
import TodoCard from './card.vue'
import NuemEmpty from '@/ui/empty.vue'
import { useTasksViewStore } from '@/pages/tasks/stores/view'
import { useTodoStore } from '@/pages/tasks/stores/todo'
import { storeToRefs } from 'pinia'
import type { Todo } from '@nao-todo/types'

defineOptions({ name: 'TodoTableMain' })

const todoStore = useTodoStore()
const tasksViewStore = useTasksViewStore()

const { todos } = storeToRefs(todoStore)
</script>

<style scoped>
.todo-table__main-wrapper {
    flex: 1 1 auto;
}

.todo-table__main {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.375rem;
}
</style>
