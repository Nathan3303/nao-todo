<template>
    <nue-container>
        <nue-main>
            <nao-tasks-view-aside :width="asideWidth" />
            <nue-separator op-target="previous" style="height: auto" />
            <nue-content fill style="overflow: hidden">
                <router-view />
            </nue-content>
            <nue-separator op-target="next" style="height: auto" />
            <nue-aside :width="outlineWidth" max-width="50%" v-if="tasksOutlineVisible">
                <tasks-multi-select
                    v-if="tasksViewStore.multiSelectStates.isShowMultiDetails"
                    :selected-ids="tasksViewStore.multiSelectStates.selectedTodoIds"
                />
                <tasks-details v-else />
            </nue-aside>
        </nue-main>
    </nue-container>
    <!-- DialogManager -->
    <tasks-dialog-loader ref="naoDialogManagerRef" />
    <!-- Dialogs -->
    <tag-color-select-dialog
        ref="tagColorSelectDialogRef"
        :handler="tasksHandlerStore.handleSelectTagColor"
    />
    <!-- Drawers -->
    <nao-tasks-view-float-aside v-if="indexAsideVisible" />
    <tasks-float-details v-if="!tasksOutlineVisible" />
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useViewStore } from '@/stores'
import { TagColorSelectDialog } from '@nao-todo/components'
import { NaoTasksViewAside, NaoTasksViewFloatAside } from './aside'
import { TasksDetails, TasksFloatDetails, TasksMultiSelect } from './outlines'
import { TasksDialogLoader } from './dialogs'
import {
    useTasksDialogStore,
    useTasksHandlerStore,
    useTasksViewStore,
    useTasksLayoutStore
} from './stores'

const viewStore = useViewStore()
const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()
const tasksHandlerStore = useTasksHandlerStore()
const tasksLayoutStore = useTasksLayoutStore()

const { indexAsideVisible, tasksOutlineVisible } = storeToRefs(viewStore)
const { asideWidth, outlineWidth } = storeToRefs(tasksLayoutStore)
const tagColorSelectDialogRef = ref<InstanceType<typeof TagColorSelectDialog>>()
const naoDialogManagerRef = ref<InstanceType<typeof TasksDialogLoader>>()

onMounted(async () => {
    tasksDialogStore.tagColorSelectDialogRef = tagColorSelectDialogRef.value
    tasksDialogStore.dialogManagerRef = naoDialogManagerRef.value
})

onBeforeRouteLeave((to, from) => {
    localStorage.setItem('tasks/lastRouteWhenLeave', from.fullPath)
})
</script>
