<template>
    <content-table
        :filter-info="filterInfo"
        base-route="tasks-today-table-task"
        @create-todo="handleCreateTodo"
    ></content-table>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ContentTable } from '@/layers/index'
import { useTodoStore, useUserStore } from '@/stores'
import moment from 'moment'
import type { Todo, TodoFilter } from '@/stores'

const userStore = useUserStore()
const todoStore = useTodoStore()

const filterInfo: TodoFilter = {
    isDeleted: false,
    relativeDate: 'today'
}

const handleCreateTodo = async (todoName: Todo['name']) => {
    // NueMessage.log(`handleCreateTodo: ${todoName}`)
    const now = moment()
    const userId = userStore.user!.id
    const newTodo: Partial<Todo> = {
        userId,
        projectId: userId,
        name: todoName,
        dueDate: {
            startAt: now.toISOString(),
            endAt: now.endOf('day').toISOString()
        }
    }
    const res = await todoStore.create2(userId, newTodo)
    if (res.code === '20000') {
        await todoStore.get(userId)
    }
}
</script>

<style scoped></style>
