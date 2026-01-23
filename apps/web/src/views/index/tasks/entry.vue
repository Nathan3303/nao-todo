<script lang="ts" setup>
import {
    TasksViewAside,
    TasksViewFloatAside,
    TasksViewDetails,
    TasksViewFloatDetails,
    TasksViewDialogs
} from '@/layouts/tasks'
import useTasksView from './tasks-view'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

defineOptions({ name: 'TasksView' })

const route = useRoute()
const {
    initializer,
    isLoading,
    error,
    asideWidth,
    outlineWidth,
    isDisplayAside,
    isUseFloatAside,
    isUseFloatOutline,
    handleResizeAside,
    handleResizeOutline
} = useTasksView()

const taskId = computed<string>(() => route.params.taskId as string)

await initializer.start()
</script>

<template>
    <loading-comp v-if="isLoading" height="100%" />
    <nue-empty v-else-if="error" :description="error" height="100%">
        <nue-button theme="primary,small" @click="initializer.retry">重试</nue-button>
    </nue-empty>
    <nue-container v-else>
        <nue-main>
            <template v-if="isDisplayAside && !isUseFloatAside">
                <tasks-view-aside :width="asideWidth" max-width="360px" min-width="240px" />
                <nue-separator op-target="previous" @resize="handleResizeAside" />
            </template>
            <tasks-view-float-aside v-else />
            <nue-content fill style="overflow: hidden">
                <router-view />
            </nue-content>
            <template v-if="!isUseFloatOutline">
                <nue-separator op-target="next" @resize="handleResizeOutline" />
                <nue-aside
                    :width="outlineWidth"
                    max-width="480px"
                    min-width="360px"
                    style="padding: 0"
                >
                    <tasks-view-details :task-id="taskId" />
                </nue-aside>
            </template>
            <tasks-view-float-details v-else />
        </nue-main>
    </nue-container>
    <tasks-view-dialogs />
</template>

