<template>
    <Loading v-if="loading" placeholder="Loading tasks..."></Loading>
    <nue-div v-else class="table-main">
        <!-- Table header -->
        <nue-div class="table-main__header">
            <!-- <nue-button icon="circle" theme="pure" disabled></nue-button> -->
            <nue-text size="12px" color="gray" flex>Name</nue-text>
            <nue-text v-if="collumns.createdAt" size="12px" color="gray" style="width: 132px">
                Create at
            </nue-text>
            <nue-text v-if="collumns.priority" size="12px" color="gray" style="width: 72px">
                Priority
            </nue-text>
            <nue-text v-if="collumns.state" size="12px" color="gray" style="width: 90px">
                Status
            </nue-text>
            <nue-icon name="more" style="opacity: 0"></nue-icon>
        </nue-div>
        <!-- Table divider -->
        <nue-divider></nue-divider>
        <!-- Empty text -->
        <template v-if="todos.length === 0">
            <nue-div align="center" justify="center" style="padding: 16px">
                <nue-text size="13px" color="gray">No tasks was found.</nue-text>
            </nue-div>
        </template>
        <!-- Table body -->
        <template v-else>
            <nue-div
                class="table-main__row"
                v-for="todo in todos"
                :key="todo.id"
                style="padding: 8px 16px"
                gap="32px"
                wrap="nowrap"
            >
                <!-- <nue-button icon="circle" theme="pure" disabled></nue-button> -->
                <nue-div vertical flex style="overflow: hidden" gap="8px">
                    <nue-button
                        class="table-main__row__name"
                        theme="pure"
                        @click="emit('showTodoDetails', todo.id)"
                        align="left"
                    >
                        {{ todo.name }}
                    </nue-button>
                    <nue-text
                        class="table-main__row__description"
                        v-if="collumns.description && todo.description"
                        size="12px"
                        color="gray"
                    >
                        {{ todo.description }}
                    </nue-text>
                </nue-div>
                <nue-div v-if="collumns.createdAt" style="width: 132px">
                    <nue-text size="12px" color="gray">
                        {{ moment(todo.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
                    </nue-text>
                </nue-div>
                <todo-priority-info
                    v-if="collumns.priority"
                    :priority="todo.priority"
                    :key="todo.priority"
                ></todo-priority-info>
                <todo-state-info
                    v-if="collumns.state"
                    :state="todo.state"
                    :key="todo.state"
                ></todo-state-info>
                <nue-icon
                    name="delete"
                    color="red"
                    @click.stop="handleDeleteTodo(todo.id)"
                ></nue-icon>
            </nue-div>
            <p></p>
        </template>
    </nue-div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { TodoPriorityInfo, TodoStateInfo, Loading } from '@/components'
import type { Todo } from '@/stores/use-todo-store'
import { NueConfirm, NueMessage } from 'nue-ui'
import moment from 'moment'

const props = defineProps<{ todos: Todo[]; loading: boolean; collumns: any }>()
const emit = defineEmits<{
    (event: 'showTodoDetails', id: Todo['id']): void
    (event: 'deleteTodo', id: Todo['id']): void
}>()

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

<style scoped>
.table-main {
    align-items: stretch;
    flex-direction: column;
    gap: 4px;
    flex: auto;
    overflow: auto;
    min-width: 480px;
    flex-wrap: nowrap;
    height: 100%;
}

.table-main__header {
    align-items: center;
    padding: 4px 16px;
    gap: 32px;
}

.table-main__row {
    border: 1px solid transparent;
    border-radius: var(--primary-radius);

    &:hover {
        border: 1px solid #ccc;
    }
}

.table-main__row__name {
    width: 100%;

    &:deep().nue-button__text {
        text-align: left;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.table-main__row__description {
    width: 100%;
    white-space: pre;
    break-word: break-all;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
