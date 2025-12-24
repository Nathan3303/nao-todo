<script setup lang="ts">
import { TasksTodoDetails } from './details'
import { useTasksViewStore } from '@/views/tasks'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksOutline' })

const tasksViewStore = useTasksViewStore()

const { outlineWidth } = storeToRefs(tasksViewStore)
</script>

<template>
    <!-- <tasks-float-todo-details v-if="isUseFloatOutline" /> -->
    <!-- <template v-else> -->
    <template>
        <nue-separator op-target="next" @resize="tasksViewStore.handleResizeOutline" />
        <nue-aside :width="outlineWidth" max-width="420px" min-width="360px" style="padding: 0">
            <tasks-todo-details
                :task-id="$route.params.taskId as string"
                :task-getter="tasksViewStore.taskApp.getByIdFromMap"
                :event-lister="tasksViewStore.eventApp.listEvent"
                :project-name-getter="tasksViewStore.getProjectName"
                :tag-getter="tasksViewStore.getTags"
            />
        </nue-aside>
    </template>
</template>

<style scoped></style>
