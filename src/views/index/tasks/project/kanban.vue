<template>
    <todo-view-kanban
        :key="route.params.projectId.toString()"
        :filter-info="todoStore.filterInfo"
        base-route="tasks-project-kanban"
        @create-todo="handleCreateTodo"
        @create-todo-by-dialog="handleCreateTodoByDialog"
    />
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { TodoViewKanban } from '@/layers'
import { useProjectStore, useUserStore, useTagStore, useTodoStore } from '@/stores'
import { useRoute } from 'vue-router'
import { createTodoWithOptions } from '@/utils'
import type { Todo } from '@/stores'
import type { TodoCreateDialogArgs } from '@/components/todo/create-dialog/types'

const route = useRoute()
const userStore = useUserStore()
const projectStore = useProjectStore()
const todoStore = useTodoStore()
const tagStore = useTagStore()

const handleCreateTodo = async (todoName: Todo['name']) => {
    const projectId = route.params.projectId as string
    const project = projectStore._toFinded(projectId)
    const createOptions = { name: todoName, project: { title: project ? project.title : '' } }
    await createTodoWithOptions(projectId, createOptions)
}

const handleCreateTodoByDialog = async (caller: (args: TodoCreateDialogArgs) => void) => {
    const projectId = route.params.projectId as string
    const project = projectStore._toFinded(projectId)
    const avalibleProjects = projectStore._toFiltered({ isDeleted: false, isArchived: false })
    // console.log(avalibleProjects)
    caller({
        userId: userStore.user!.id,
        projects: avalibleProjects,
        tags: tagStore.tags,
        presetInfo: {
            projectId,
            project: { title: project ? project.title : '' }
        }
    })
}
</script>
