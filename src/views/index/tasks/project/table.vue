<template>
    <todo-view-table
        :key="route.params.projectId.toString()"
        :filter-info="filterInfo"
        base-route="tasks-project-table"
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
import { TodoViewTable } from '@/layers'
import { useRoute } from 'vue-router'
import { createTodoWithOptions } from '@/utils'
import { useProjectStore, useTagStore, useUserStore } from '@/stores'
import type { Todo, TodoFilter } from '@/stores'
import type { Columns } from '@/components'
import type { TodoCreateDialogArgs } from '@/components/todo/create-dialog/types'

const route = useRoute()
const userStore = useUserStore()
const projectStore = useProjectStore()
const tagStore = useTagStore()

const filterInfo = computed<TodoFilter>(() => {
    const projectId = route.params.projectId as string
    return {
        isDeleted: false,
        projectId
    }
})

const columns: Columns = {
    createdAt: false,
    updatedAt: false,
    endAt: true,
    priority: true,
    state: true,
    description: true
}

const handleCreateTodo = async (todoName: Todo['name']) => {
    const projectId = route.params.projectId as string
    const project = projectStore._toFinded(projectId)
    const createOptions = { name: todoName, project: { title: project ? project.title : '' } }
    await createTodoWithOptions(projectId, createOptions)
}

const handleCreateTodoByDialog = async (caller: (args: TodoCreateDialogArgs) => void) => {
    const projectId = route.params.projectId as string
    const project = projectStore._toFinded(projectId)
    caller({
        userId: userStore.user!.id,
        projects: projectStore.projects,
        tags: tagStore.tags,
        presetInfo: {
            projectId,
            project: { title: project ? project.title : '' }
        }
    })
}
</script>
