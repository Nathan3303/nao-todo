<template>
    <todo-view-table
        :key="viewInfo?.id"
        :filter-info="todoStore.getOptions"
        base-route="tasks-project-table"
        @create-todo-by-dialog="handleCreateTodoByDialog"
    />
    <router-view></router-view>
</template>

<script setup lang="ts">
import { TodoViewTable } from '@/layers'
import { useProjectStore, useTagStore, useUserStore, useTodoStore } from '@/stores'
import { useTasksViewStore } from '../stores'
import { storeToRefs } from 'pinia'
import type { TodoCreateDialogArgs } from '@nao-todo/components/todo/create-dialog/types'

const userStore = useUserStore()
const projectStore = useProjectStore()
const todoStore = useTodoStore()
const tagStore = useTagStore()
const tasksViewStore = useTasksViewStore()

const { viewInfo } = storeToRefs(tasksViewStore)

const handleCreateTodoByDialog = async (caller: (args: TodoCreateDialogArgs) => void) => {
    if (!viewInfo.value) return
    const { id, title } = viewInfo.value
    const avalibleProjects = projectStore.findProjectsFromLocal({
        isDeleted: false,
        isArchived: false
    })
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
