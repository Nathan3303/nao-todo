<script lang="ts" setup>
import { TasksViewAside, TasksViewDetails, TasksViewDialogs } from '@/layouts/tasks'
import { Loading as LoadingComp } from '@nao-todo/components'
import useTasksViewStore from './tasks-view-store'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

defineOptions({ name: 'TasksView' })

const tasksViewStore = useTasksViewStore()

const { asideWidth, outlineWidth } = storeToRefs(tasksViewStore)

const projects = computed(() => tasksViewStore.projectApp.projects)

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
            <tasks-view-aside :width="asideWidth" max-width="360px" min-width="240px" />
            <nue-separator op-target="previous" @resize="tasksViewStore.handleResizeAside" />
            <nue-content fill style="overflow: hidden">
                <router-view />
            </nue-content>
            <nue-separator op-target="next" @resize="tasksViewStore.handleResizeOutline" />
            <nue-aside :width="outlineWidth" max-width="480px" min-width="360px" style="padding: 0">
                <tasks-view-details
                    :task-id="$route.params.taskId"
                    :projects="projects"
                    :event-lister="tasksViewStore.eventApp.listEvent"
                    :comment-lister="tasksViewStore.commentApp.list"
                    :project-name-getter="tasksViewStore.projectHandlers.getNameById"
                    :tag-getter="tasksViewStore.tagHandlers.getTagsByTagIds"
                    :task-getter="tasksViewStore.taskApp.getByIdFromMap"
                    :width="outlineWidth"
                />
            </nue-aside>
        </nue-main>
    </nue-container>
    <tasks-view-dialogs />
</template>
