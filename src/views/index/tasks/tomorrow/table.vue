<template>
    <content-table
        :filter-info="filterInfo"
        base-route="tasks-tomorrow-table"
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
    relativeDate: 'tomorrow'
}

const handleCreateTodo = async (todoName: Todo['name']) => {
    const tomorrow = moment().add(1, 'day')
    await createTodoWithOptions(null, {
        name: todoName,
        dueDate: {
            startAt: tomorrow.toISOString(),
            endAt: tomorrow.endOf('day').toISOString()
        }
    })
}
</script>

<style scoped></style>
