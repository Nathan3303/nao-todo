<template>
    <content-table
        :filter-info="filterInfo"
        base-route="tasks-all-table"
        @create-todo="handleCreateTodo"
        @create-todo-by-dialog="handleCreateTodoByDialog"
    ></content-table>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ContentTable } from '@/layers/index'
import { useTodoStore, useUserStore, useProjectStore, useTagStore } from '@/stores'
import { createTodoWithOptions } from '@/utils'
import moment from 'moment'
import type { Todo, TodoFilter } from '@/stores'
import type { TodoCreateDialogArgs } from '@/components/todo/create-dialog/types'

const userStore = useUserStore()
const todoStore = useTodoStore()
const projectStore = useProjectStore()
const tagStore = useTagStore()

const filterInfo: TodoFilter = {
    isDeleted: false
}

const handleCreateTodo = async (todoName: Todo['name']) => {
    await createTodoWithOptions(null, { name: todoName })
}

const handleCreateTodoByDialog = async (caller: (args: TodoCreateDialogArgs) => void) => {
    caller({
        userId: userStore.user!.id,
        projects: projectStore.projects,
        tags: tagStore.tags,
    })
}
</script>
