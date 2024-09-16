<template>
    <todo-view-table
        :filter-info="filterInfo"
        base-route="tasks-all-table"
        @create-todo="handleCreateTodo"
        @create-todo-by-dialog="handleCreateTodoByDialog"
    />
    <suspense>
        <router-view />
    </suspense>
</template>

<script setup lang="ts">
import { TodoViewTable } from '@/layers'
import { useUserStore, useProjectStore, useTagStore } from '@/stores'
import { createTodoWithOptions } from '@/utils'
import type { Todo, TodoFilter } from '@/stores'
import type { TodoCreateDialogArgs } from '@/components/todo/create-dialog/types'

const userStore = useUserStore()
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
        tags: tagStore.tags
    })
}
</script>
