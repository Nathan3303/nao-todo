<template>
    <content-table
        :key="route.params.tagId.toString()"
        :filter-info="filterInfo"
        base-route="tasks-tag-table"
        :columns="columns"
        @create-todo="handleCreateTodo"
        @create-todo-by-dialog="handleCreateTodoByDialog"
    ></content-table>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ContentTable } from '@/layers/index'
import { useUserStore, useTagStore, useProjectStore } from '@/stores'
import { useRoute } from 'vue-router'
import { createTodoWithOptions } from '@/utils'
import type { Todo, TodoFilter } from '@/stores'
import type { Columns } from '@/components'
import type { TodoCreateDialogArgs } from '@/components/todo/create-dialog/types'

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
