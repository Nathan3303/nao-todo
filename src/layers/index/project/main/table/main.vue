<template>
    <nue-div
        vertical
        align="stretch"
        gap="4px"
        flex
        wrap="nowrap"
        height="100%"
        style="overflow: auto; min-width: 480px"
    >
        <!-- Table header -->
        <nue-div align="center" style="padding: 4px 16px" gap="32px">
            <!-- <nue-button icon="circle" theme="pure" disabled></nue-button> -->
            <nue-text size="12px" color="gray" flex>Name</nue-text>
            <nue-text size="12px" color="gray" style="width: 72px">Priority</nue-text>
            <nue-text size="12px" color="gray" style="width: 90px">Status</nue-text>
            <nue-icon name="more" style="opacity: 0"></nue-icon>
        </nue-div>

        <nue-divider></nue-divider>

        <!-- Empty text -->
        <template v-if="todos.length === 0">
            <nue-div align="center" justify="center" style="padding: 16px">
                <nue-text size="12px" color="gray">No tasks found.</nue-text>
            </nue-div>
        </template>

        <!-- Table body -->
        <template v-else>
            <nue-div
                v-for="todo in todos"
                :key="todo.id"
                align="center"
                style="padding: 8px 16px"
                gap="32px"
                wrap="nowrap"
            >
                <!-- <nue-button icon="circle" theme="pure" disabled></nue-button> -->
                <nue-div flex style="overflow: hidden">
                    <nue-button theme="pure" @click="handleShowTodoDetails(todo.id)">
                        {{ todo.name }}
                    </nue-button>
                </nue-div>
                <todo-priority-info
                    :priority="todo.priority"
                    :key="todo.priority"
                ></todo-priority-info>
                <todo-state-info :state="todo.state" :key="todo.state"></todo-state-info>
                <nue-icon
                    name="delete"
                    color="#FF5722"
                    @click.stop="handleDeleteTodo(todo.id)"
                ></nue-icon>
            </nue-div>
        </template>
    </nue-div>
</template>

<script setup lang="ts">
import { TodoPriorityInfo, TodoStateInfo } from '@/components'
import type { Todo } from '@/stores/use-todo-store'
import { NueConfirm, NueMessage } from 'nue-ui'

const props = defineProps<{ todos: Todo[] }>()
const emit = defineEmits<{
    (event: 'showTodoDetails', id: Todo['id']): void
    (event: 'deleteTodo', id: Todo['id']): void
}>()

function handleShowTodoDetails(id: Todo['id']) {
    emit('showTodoDetails', id)
}

function handleDeleteTodo(id: Todo['id']) {
    NueConfirm({
        title: 'Delete confirmation',
        content: 'Are you sure to delete this task?'
    }).then(
        () => emit('deleteTodo', id),
        () => NueMessage.info('Operation canceled')
    )
}
</script>
