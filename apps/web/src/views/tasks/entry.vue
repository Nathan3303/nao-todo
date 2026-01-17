<script lang="ts" setup>
import {
    TasksViewAside,
    TasksViewFloatAside,
    TasksViewDetails,
    TasksViewFloatDetails,
    TasksViewDialogs
} from '@/layouts/tasks'
import { Loading as LoadingComp } from '@nao-todo/components'
import useTasksViewStore from './tasks-view-store'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

defineOptions({ name: 'TasksView' })

const tasksViewStore = useTasksViewStore()
const route = useRoute()

const { asideWidth, outlineWidth, isDisplayAside, isUseFloatAside, isUseFloatOutline } =
    storeToRefs(tasksViewStore)

const projects = computed(() => tasksViewStore.projectApp.states.projects)
const taskId = computed<string>(() => route.params.taskId as string)

await tasksViewStore.initializer.start()
</script>

<template>
    <loading-comp
        v-if="tasksViewStore.initializer.loading"
        :placeholder="tasksViewStore.initializer.placeholder"
        height="100%"
    />
    <nue-empty
        v-else-if="tasksViewStore.initializer.error"
        :description="tasksViewStore.initializer.errorMessage"
        height="100%"
    >
        <nue-button theme="primary,small" @click="tasksViewStore.initializer.retry">
            重试
        </nue-button>
    </nue-empty>
    <nue-container v-else>
        <nue-main>
            <template v-if="isDisplayAside && !isUseFloatAside">
                <tasks-view-aside :width="asideWidth" max-width="360px" min-width="240px" />
                <nue-separator op-target="previous" @resize="tasksViewStore.handleResizeAside" />
            </template>
            <tasks-view-float-aside v-else />
            <nue-content fill style="overflow: hidden">
                <router-view />
            </nue-content>
            <template v-if="!isUseFloatOutline">
                <nue-separator op-target="next" @resize="tasksViewStore.handleResizeOutline" />
                <nue-aside
                    :width="outlineWidth"
                    max-width="480px"
                    min-width="360px"
                    style="padding: 0"
                >
                    <tasks-view-details
                        :task-id="taskId"
                        :projects="projects"
                        :event-lister="tasksViewStore.eventApp.listEvent"
                        :comment-lister="tasksViewStore.commentApp.list"
                        :project-name-getter="tasksViewStore.projectHandlers.getNameById"
                        :tag-getter="tasksViewStore.tagHandlers.getTagsByTagIds"
                        :task-getter="tasksViewStore.taskApp.getByIdFromMap"
                    />
                </nue-aside>
            </template>
            <tasks-view-float-details v-else />
        </nue-main>
    </nue-container>
    <tasks-view-dialogs />
</template>

