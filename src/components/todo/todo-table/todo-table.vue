<template>
    <nue-div class="todo-table">
        <nue-div class="todo-table-header">
            <nue-text theme="col" flex>Name</nue-text>
            <nue-text v-if="columns.createdAt" theme="col" style="width: 132px">
                Create at
            </nue-text>
            <nue-text v-if="columns.updatedAt" theme="col" style="width: 132px">
                Update at
            </nue-text>
            <nue-text v-if="columns.priority" theme="col" style="width: 72px"> Priority </nue-text>
            <nue-text v-if="columns.state" theme="col" style="width: 90px"> Status </nue-text>
            <nue-icon name="more" style="opacity: 0"></nue-icon>
        </nue-div>
        <nue-divider></nue-divider>
        <empty :empty="!todos.length" text-size="12px" full-height>
            <nue-div class="todo-table-main__row" v-for="todo in todos" :key="todo.id">
                <nue-div vertical flex style="overflow: hidden" gap="8px">
                    <nue-button
                        class="todo-table-main__row__name"
                        theme="pure"
                        @click="handleShowDetails(todo.id)"
                        align="left"
                    >
                        {{ todo.name }}
                        <template v-if="todo.justUpdated" #append>
                            <nue-text
                                size="12px"
                                color="orange"
                                @click.stop="todo.justUpdated = false"
                            >
                                (just updated)
                            </nue-text>
                        </template>
                    </nue-button>
                    <nue-text
                        v-if="columns.description && todo.description"
                        class="todo-table-main__row__description"
                        size="12px"
                        color="gray"
                    >
                        {{ todo.description }}
                    </nue-text>
                </nue-div>
                <nue-div v-if="columns.createdAt" style="width: 132px">
                    <nue-text size="12px" color="gray">
                        {{ moment(todo.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
                    </nue-text>
                </nue-div>
                <nue-div v-if="columns.updatedAt" style="width: 132px">
                    <nue-text size="12px" color="gray">
                        {{ moment(todo.updatedAt).format('YYYY-MM-DD HH:mm:ss') }}
                    </nue-text>
                </nue-div>
                <todo-priority-info
                    v-if="columns.priority"
                    :priority="todo.priority"
                    :key="todo.priority"
                ></todo-priority-info>
                <todo-state-info
                    v-if="columns.state"
                    :state="todo.state"
                    :key="todo.state"
                ></todo-state-info>
                <nue-icon
                    name="delete"
                    color="red"
                    @click.stop="handleDeleteTodo(todo.id)"
                ></nue-icon>
            </nue-div>
        </empty>
    </nue-div>
</template>

<script setup lang="ts">
import type { TodoTableEmits, TodoTableProps } from './types'
import { TodoPriorityInfo, TodoStateInfo, Empty } from '@/components'
import moment from 'moment'
import './todo-table.css'

defineOptions({ name: 'TodoTable' })
defineProps<TodoTableProps>()
const emit = defineEmits<TodoTableEmits>()

const handleDeleteTodo = (id: string) => {
    emit('deleteTodo', id)
}

const handleShowDetails = (id: string) => {
    emit('showTodoDetails', id)
}
</script>
