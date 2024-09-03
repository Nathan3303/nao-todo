<template>
    <content-table
        :filter-info="filterInfo"
        base-route="tasks-all-table"
        @create-todo="handleCreateTodo"
    ></content-table>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ContentTable } from '@/layers/index'
import { useTodoStore, useUserStore } from '@/stores'
import { createTodoWithOptions } from '@/utils'
import moment from 'moment'
import type { Todo, TodoFilter } from '@/stores'

const userStore = useUserStore()
const todoStore = useTodoStore()

const filterInfo: TodoFilter = {
    isDeleted: false
}

const handleCreateTodo = async (todoName: Todo['name']) => {
    await createTodoWithOptions(null, { name: todoName })
}
</script>
