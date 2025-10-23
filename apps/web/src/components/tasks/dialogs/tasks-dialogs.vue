<script setup lang="ts">
import { useTasksDialogStore } from '@/stores/tasks'
import {
    ProjectCreator,
    ProjectManager,
    TagCreator,
    TagColorUpdater,
    TagManager,
    TodoCreator
} from '@/components/tasks/dialogs'

defineOptions({ name: 'TasksDialogManager' })

const tasksDialogStore = useTasksDialogStore()
</script>

<template>
    <project-creator @register="tasksDialogStore.handleProjectCreatorRegister" />
    <project-manager @register="tasksDialogStore.handleProjectManagerRegister" />
    <tag-creator @register="tasksDialogStore.handleTagCreatorRegister" />
    <tag-manager @register="tasksDialogStore.handleTagManagerRegister" />
    <tag-color-updater @register="tasksDialogStore.handleTagColorUpdaterRegister" />
    <todo-creator @register="tasksDialogStore.handleTodoCreatorRegister" />
</template>

