<template>
    <content-table
        :filter-info="filterInfo"
        base-route="tasks-recycle-table"
        @create-todo="handleCreateTodo"
    ></content-table>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ContentTable } from '@/layers/index'
import { useTodoStore, useUserStore } from '@/stores'
import type { Todo, TodoFilter } from '@/stores'

const userStore = useUserStore()
const todoStore = useTodoStore()

const filterInfo: TodoFilter = {
    isDeleted: true
}

const handleCreateTodo = async (todoName: Todo['name']) => {
    const userId = userStore.user!.id
    const newTodo: Partial<Todo> = {
        userId,
        projectId: userId,
        name: todoName
    }
    const res = await todoStore.create(userId, newTodo)
    if (res.code === '20000') {
        await todoStore.get(userId)
    }
}
</script>

<style scoped></style>
