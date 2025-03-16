<template>
    <nue-container class="tasks-view" theme="vertical,inner">
        <nue-main
            :allow-collapse-aside="false"
            :allow-collapse-outline="false"
            :allow-hide-aside="false"
            :allow-resize-aside="responsiveFlag > 1"
            aside-max-width="300px"
            aside-min-width="200px"
            @after-aside-resize="tasksLayoutStore.handleAfterAsideResize"
            :aside-width="asideWidth"
            class="tasks-view__main"
            outline-max-width="480px"
            outline-min-width="360px"
            :outline-width="outlineWidth"
            @after-outline-resize="tasksLayoutStore.handleAfterOutlineResize"
        >
            <template v-if="projectAsideVisible" #aside>
                <tasks-aside />
            </template>
            <template #content>
                <router-view />
            </template>
            <template v-if="tasksOutlineVisible" #outline>
                <tasks-multi-select
                    v-if="tasksViewStore.multiSelectStates.isShowMultiDetails"
                    :selected-ids="tasksViewStore.multiSelectStates.selectedTodoIds"
                />
                <tasks-details v-else />
            </template>
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
    <tasks-float-aside v-if="indexAsideVisible" />
    <tasks-float-details v-if="!tasksOutlineVisible" />
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useViewStore } from '@/stores'
import { TagColorSelectDialog } from '@nao-todo/components'
import {
    useTasksDialogStore,
    useTasksHandlerStore,
    useTasksLayoutStore,
    useTasksViewStore
} from '.'
import {
    TasksAside,
    TasksDetails,
    TasksDialogLoader,
    TasksFloatAside,
    TasksFloatDetails,
    TasksMultiSelect
} from './components'

const viewStore = useViewStore()
const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()
const tasksHandlerStore = useTasksHandlerStore()
const tasksLayoutStore = useTasksLayoutStore()

const { projectAsideVisible, indexAsideVisible, responsiveFlag, tasksOutlineVisible } =
    storeToRefs(viewStore)
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
