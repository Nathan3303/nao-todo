<template>
    <content-table
        :filter-info="filterInfo"
        base-route="tasks-week-table"
        @create-todo="handleCreateTodo"
    ></content-table>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ContentTable } from '@/layers/index'
import { createTodoWithOptions } from '@/utils'
import moment from 'moment'
import type { Todo, TodoFilter } from '@/stores'

const filterInfo: TodoFilter = {
    isDeleted: false,
    relativeDate: 'week'
}

const handleCreateTodo = async (todoName: Todo['name']) => {
    const now = moment()
    await createTodoWithOptions(null, {
        name: todoName,
        dueDate: {
            startAt: now.toISOString(),
            endAt: now.add(7, 'd').endOf('d').toISOString()
        }
    })
}
</script>

<style scoped></style>
