<template>
    <todo-view-kanban
        :key="route.params.projectId.toString()"
        :filter-info="filterInfo"
        base-route="tasks-project-kanban"
        @create-todo="handleCreateTodo"
        @create-todo-by-dialog="handleCreateTodoByDialog"
    ></todo-view-kanban>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { TodoViewKanban } from '@/layers'
import { useProjectStore, useUserStore, useTagStore } from '@/stores'
import { useRoute } from 'vue-router'
import type { Todo, TodoFilter } from '@/stores'
import { createTodoWithOptions } from '@/utils'
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

<style scoped></style>
