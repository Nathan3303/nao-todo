<script setup lang="ts">
import { computed, inject } from 'vue'
import TasksViewDetails from './details.vue'
import TasksViewDetailsDrawer from './float-details.vue'
import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import { useRoute } from 'vue-router'

defineOptions({ name: 'TasksViewDetailsAdapter' })

const route = useRoute()
const tasksViewContext = inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!

const taskId = computed<string>(() => route.params.taskId as string)
</script>

<template>
    <template v-if="tasksViewContext.isUseFloatOutline">
        <tasks-view-details-drawer />
    </template>
    <template v-else>
        <nue-separator op-target="next" @resize="tasksViewContext.handleResizeOutline" />
        <nue-aside
            :width="tasksViewContext.outlineWidth"
            max-width="480px"
            min-width="360px"
            style="padding: 0"
        >
            <tasks-view-details :task-id="taskId" />
        </nue-aside>
    </template>
</template>

<style scoped></style>
