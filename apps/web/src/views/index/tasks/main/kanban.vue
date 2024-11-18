<template>
    <todo-view-kanban
        :key="viewInfo?.id"
        :base-route="baseRouteName"
        @create-todo-by-dialog="handleCreateTodoByDialog"
    />
</template>

<script setup lang="ts">
import { TodoViewKanban } from '@/layers'
import { useProjectStore, useTagStore, useUserStore } from '@/stores'
import { useTasksViewStore } from '../stores'
import { storeToRefs } from 'pinia'
import type { CreateTodoDialogCallerArgs } from '@/layers/create-todo-dialog/types'

const userStore = useUserStore()
const projectStore = useProjectStore()
const tagStore = useTagStore()
const tasksViewStore = useTasksViewStore()

const { viewInfo, baseRouteName } = storeToRefs(tasksViewStore)

const handleCreateTodoByDialog = async (caller: (args: CreateTodoDialogCallerArgs) => void) => {
    if (!viewInfo.value) return
    const { id } = viewInfo.value
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
            ...viewInfo.value.createTodoOptions
        }
    })
}
</script>
