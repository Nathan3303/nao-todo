<template>
    <nue-div class="todo-table">
        <nue-div class="todo-table-header">
            <nue-text theme="col" flex>名称</nue-text>
            <nue-text v-if="columns.createdAt" theme="col" style="width: 130px">
                创建时间
            </nue-text>
            <nue-text v-if="columns.updatedAt" theme="col" style="width: 130px">
                最后修改时间
            </nue-text>
            <nue-text v-if="columns.priority" theme="col" style="width: 50px"> 优先级 </nue-text>
            <nue-text v-if="columns.state" theme="col" style="width: 80px"> 状态 </nue-text>
            <nue-icon name="more" style="opacity: 0"></nue-icon>
        </nue-div>
        <nue-divider></nue-divider>
        <empty :empty="!todos.length" text-size="12px" full-height message="当前列表无数据。">
            <nue-div class="todo-table-main__row" v-for="todo in todos" :key="todo.id">
                <nue-div vertical flex style="overflow: hidden" gap="8px">
                    <nue-button
                        class="todo-table-main__row__name"
                        theme="pure"
                        @click="handleShowDetails(todo.id)"
                        align="left"
                    >
                        {{ todo.name }}
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
                <nue-div v-if="columns.createdAt" style="width: 130px">
                    <nue-text size="12px" color="gray">
                        {{ moment(todo.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
                    </nue-text>
                </nue-div>
                <nue-div v-if="columns.updatedAt" style="width: 130px">
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
