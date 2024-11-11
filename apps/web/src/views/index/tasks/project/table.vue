<template>
    <todo-view-table
        :key="route.params.projectId.toString()"
        :filter-info="todoStore.filterInfo"
        base-route="tasks-project-table"
        @create-todo="handleCreateTodo"
        @create-todo-by-dialog="handleCreateTodoByDialog"
    />
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { TodoViewTable } from '@/layers'
import { useRoute } from 'vue-router'
import { createTodoWithOptions } from '@/handlers/todo-handlers'
import { useProjectStore, useTagStore, useUserStore, useTodoStore } from '@/stores'
import { projectViewContextKey } from './constants'
import type { Todo } from '@/stores'
import type { TodoCreateDialogArgs } from '@nao-todo/components/todo/create-dialog/types'
import type { ProjectViewContext } from './types'

const route = useRoute()
const userStore = useUserStore()
const projectStore = useProjectStore()
const todoStore = useTodoStore()
const tagStore = useTagStore()

const { project } = inject<ProjectViewContext>(projectViewContextKey)!

const handleCreateTodo = async (todoName: Todo['name']) => {
    if (!project.value) return
    const { id, title } = project.value
    await createTodoWithOptions(id, {
        name: todoName,
        project: { title: title || '' }
    })
}

const handleCreateTodoByDialog = async (caller: (args: TodoCreateDialogArgs) => void) => {
    if (!project.value) return
    const { id, title } = project.value
    const avalibleProjects = projectStore._toFiltered({ isDeleted: false, isArchived: false })
    caller({
        userId: userStore.user!.id,
        projects: avalibleProjects,
        tags: tagStore.tags,
        presetInfo: {
            projectId: id,
            project: { title: title || '' }
        }
    })
}
</script>
