<template>
    <content-table
        :filter-info="filterInfo"
        base-route="tasks-inbox-table"
        @create-todo="handleCreateTodo"
    ></content-table>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ContentTable } from '@/layers/index'
import { useUserStore } from '@/stores'
import { createTodoWithOptions } from '@/utils'
import type { Todo, TodoFilter } from '@/stores'

const userStore = useUserStore()

const filterInfo: TodoFilter = {
    isDeleted: false,
    projectId: userStore.user!.id
}

const handleCreateTodo = async (todoName: Todo['name']) => {
    await createTodoWithOptions(null, { name: todoName })
}
</script>
