<script setup lang="ts">
import { computed, watch, inject } from 'vue'
import { useRoute } from 'vue-router'
import TaskDetails from './details.vue'
import { TASK_DETAILS_PRE_CONTEXT_KEY } from './context'

const route = useRoute()

const { isDisplayOutline } = inject(TASK_DETAILS_PRE_CONTEXT_KEY)!

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
        @after-close="$router.push({ params: { taskId: '' } })"
    >
        <task-details :task-id="taskId" />
    </nue-drawer>
</template>

