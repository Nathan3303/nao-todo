<template>
    <todo-view-table
        :key="route.params.tagId.toString()"
        :filter-info="filterInfo"
        base-route="tasks-tag-table"
        :columns="columns"
        @create-todo="handleCreateTodo"
        @create-todo-by-dialog="handleCreateTodoByDialog"
    ></todo-view-table>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TodoViewTable } from '@nao-todo/layers'
import { useUserStore, useTagStore, useProjectStore } from '@nao-todo/stores'
import { useRoute } from 'vue-router'
import { createTodoWithOptions } from '@nao-todo/handlers'
import type { Todo, TodoFilter } from '@nao-todo/stores'
import type { Columns } from '@nao-todo/components'
import type { TodoCreateDialogArgs } from '@nao-todo/components/todo/create-dialog/types'

const route = useRoute()
const userStore = useUserStore()
const projectStore = useProjectStore()
const tagStore = useTagStore()

const filterInfo = computed<TodoFilter>(() => {
    const tagId = route.params.tagId as string
    return {
        isDeleted: false,
        tagId
    }
})

const columns: Columns = {
    createdAt: false,
    updatedAt: false,
    endAt: true,
    priority: true,
    state: true,
    description: true,
    project: true
}

const handleCreateTodo = async (todoName: Todo['name']) => {
    const tagId = route.params.tagId as string
    await createTodoWithOptions(null, { name: todoName, tags: [tagId] })
}

const handleCreateTodoByDialog = async (caller: (args: TodoCreateDialogArgs) => void) => {
    const tagId = route.params.tagId as string
    caller({
        userId: userStore.user!.id,
        projects: projectStore.projects,
        tags: tagStore.tags,
        presetInfo: { tags: [tagId] }
    })
}
</script>

<style scoped></style>
