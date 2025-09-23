<template>
    <loading-comp v-if="loading" style="height: 100%" />
    <nue-container v-else>
        <nue-main>
            <tasks-aside :width="asideWidth" max-width="256px" />
            <nue-separator op-target="previous" @resize="tasksViewStore.handleAsideResize" />
            <nue-content fill style="overflow: hidden">
                <router-view />
            </nue-content>
            <nue-separator op-target="next" @resize="tasksViewStore.handleOutlineResize" />
            <nue-aside :width="outlineWidth" max-width="420px" style="padding: 0">
                <!--                <tasks-multi-select-->
                <!--                    v-if="tasksViewStore.multiSelectStates.isShowMultiDetails"-->
                <!--                    :selected-ids="tasksViewStore.multiSelectStates.selectedTodoIds"-->
                <!--                />-->
                <tasks-todo-details />
            </nue-aside>
        </nue-main>
    </nue-container>
    <tasks-dialogs />
    <tasks-aside-drawer v-if="false" />
    <!--    <tasks-float-details v-if="!tasksOutlineVisible" />-->
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { TasksAside, TasksAsideDrawer, TasksTodoDetails } from '@/layouts'
import { useTasksDataStore, useTasksViewStore } from '@/stores/tasks'
import { TasksDialogs } from '@/components/tasks/dialogs'
import { Loading as LoadingComp } from '@nao-todo/components'
import { ref } from 'vue'

const tasksDataStore = useTasksDataStore()
const tasksViewStore = useTasksViewStore()

const { asideWidth, outlineWidth } = storeToRefs(tasksViewStore)
const loading = ref(true)

tasksDataStore.getProjectsAndTags().then(() => {
    loading.value = false
})
</script>
