<template>
    <loading-comp v-if="loading" style="height: 100%" />
    <nue-container v-else>
        <nue-main>
            <template v-if="isDisplayAside">
                <tasks-aside :width="asideWidth" max-width="256px" min-width="180px" />
                <nue-separator op-target="previous" @resize="tasksViewStore.handleAsideResize" />
            </template>
            <nue-content fill style="overflow: hidden">
                <router-view />
            </nue-content>
            <template v-if="tasksTodoDetailsDiaplay">
                <nue-separator op-target="next" @resize="tasksViewStore.handleOutlineResize" />
                <nue-aside
                    :width="outlineWidth"
                    max-width="420px"
                    min-width="360px"
                    style="padding: 0"
                >
                    <tasks-todo-details />
                </nue-aside>
            </template>
        </nue-main>
    </nue-container>
    <tasks-dialogs />
    <tasks-aside-drawer v-if="false" />
    <tasks-todo-details-drawer v-if="!tasksTodoDetailsDiaplay" />
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { TasksAside, TasksAsideDrawer, TasksTodoDetails, TasksTodoDetailsDrawer } from '@/layouts'
import { useTasksDataStore, useTasksViewStore } from '@/stores/tasks'
import { TasksDialogs } from '@/components/tasks/dialogs'
import { Loading as LoadingComp } from '@nao-todo/components'
import { ref } from 'vue'

const tasksDataStore = useTasksDataStore()
const tasksViewStore = useTasksViewStore()

const { asideWidth, outlineWidth, responsiveFlag, isDisplayAside } = storeToRefs(tasksViewStore)
const loading = ref(true)

const tasksTodoDetailsDiaplay = computed(() => responsiveFlag.value > 2)

tasksDataStore.getProjectsAndTags().then(() => {
    loading.value = false
})
</script>
