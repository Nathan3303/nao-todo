<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import TaskDetails from './index.vue'
import { useTasksViewStore } from '@/views/tasks'
import { storeToRefs } from 'pinia'

const tasksViewStore = useTasksViewStore()
const route = useRoute()

const { isDisplayOutline } = storeToRefs(tasksViewStore)

const projects = computed(() => tasksViewStore.projectApp.states.projects)
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
        <task-details
            :task-id="taskId"
            :projects="projects"
            :event-lister="tasksViewStore.eventApp.listEvent"
            :comment-lister="tasksViewStore.commentApp.list"
            :project-name-getter="tasksViewStore.projectHandlers.getNameById"
            :tag-getter="tasksViewStore.tagHandlers.getTagsByTagIds"
            :task-getter="tasksViewStore.taskApp.getByIdFromMap"
        />
    </nue-drawer>
</template>
