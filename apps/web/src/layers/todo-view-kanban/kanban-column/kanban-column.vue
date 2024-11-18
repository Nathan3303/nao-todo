<template>
    <nue-container class="kanban-column" theme="vertical,inner">
        <nue-header class="kanban-column__header" height="32px" style="box-sizing: border-box">
            <todo-state-info :state="category" />
            <nue-text color="gray" size="12px">{{ todos.length }}</nue-text>
        </nue-header>
        <nue-main class="kanban-column__main" style="border: none">
            <empty :empty="!todos.length" message="没有数据。" />
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

<style scoped>
.kanban-column {
    min-width: 260px;
    height: 100%;
    flex: 1 1 auto;

    .kanban-column__header {
        align-items: center;
        padding: 0;
        border: none;

        .nue-text--count {
            min-width: 24px;
            height: 24px;
            line-height: 24px;
            font-size: 14px;
            background-color: var(--primary-color);
            color: white;
            border-radius: var(--primary-radius);
            text-align: center;
        }
    }

    .kanban-column__main {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
        overflow-y: auto;
        margin-top: 16px;

        .empty {
            height: auto;
            font-size: 12px;
            flex: none;
            width: 100%;
            background-color: #f5f5f5;
            border-radius: var(--primary-radius);

            &:deep().nue-text {
                font-size: 12px;
                margin: 8px;
            }
        }

        &:deep(.nue-main__content) {
            padding: 0;
            gap: 8px;
        }
    }
}

.kanban-column__main--drag-over {
    .kanban-column__header {
        background-color: #f5f5f5;
        position: relative;

        &::after {
            display: block;
            width: 100%;
            height: 32px;
            line-height: 32px;
            content: '将任务移动到此栏';
            position: absolute;
            left: 0;
            top: 0;
            background-color: white;
            color: gray;
            text-align: center;
            font-size: 12px;
            font-weight: bold;
        }
    }

    .kanban-column__main {
        background-color: #f5f5f5;
        box-shadow: 0 0 1px 1px #33333333;
        opacity: 0.6;
    }
}

</style>
