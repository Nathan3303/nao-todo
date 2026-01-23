<script setup lang="ts">
import { computed, watch, inject } from 'vue'
import { useRoute } from 'vue-router'
import TaskDetails from './index.vue'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'

const route = useRoute()

// @viewContext TasksView context
const { isDisplayOutline } = inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!

const taskId = computed<string>(() => route.params.taskId as string)

watch(
    () => route.params.taskId,
    (newTasksId) => (isDisplayOutline.value = !!newTasksId),
    { immediate: true }
)
</script>

<template>
    <nue-drawer
        v-model="isDisplayOutline"
        theme="float-aside"
        span="min(100%,448px)"
        min-span="360px"
        allow-close-by-overlay
    >
        <task-details :task-id="taskId" />
    </nue-drawer>
</template>
