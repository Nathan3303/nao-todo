<template>
    <nue-div class="todo-table-main__row" v-for="todo in todos" :key="todo.id">
        <nue-div vertical flex style="overflow: hidden" gap="8px">
            <nue-button
                class="todo-table-main__row__name"
                theme="pure"
                @click="showDetailsHandler(todo.id)"
                align="left"
            >
                {{ todo.name }}
            </nue-button>
            <nue-text
                v-if="columns.description"
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
        <nue-icon name="delete" color="red" @click.stop="deleteHandler(todo.id)"></nue-icon>
    </nue-div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { TodoPriorityInfo, TodoStateInfo } from '@/components'
import moment from 'moment'
import type { TodoTableContext } from './types'

const { todos, columns, deleteHandler, showDetailsHandler } = inject(
    'todoTableContext'
) as TodoTableContext
</script>

<style scoped></style>
