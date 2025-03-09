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
                <index-aside />
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
    <nao-dialog-manager ref="naoDialogManagerRef" />
    <!-- Dialogs -->
    <create-project-dialog
        ref="createProjectDialogRef"
        :handler="tasksHandlerStore.handleCreateProject"
    />
    <create-todo-dialog ref="createTodoDialogRef" :handler="tasksHandlerStore.handleCreateTodo" />
    <create-tag-dialog ref="createTagDialogRef" :handler="tasksHandlerStore.handleCreateTag" />
    <tag-color-select-dialog
        ref="tagColorSelectDialogRef"
        :handler="tasksHandlerStore.handleSelectTagColor"
    />
    <!-- Drawers -->
    <float-aside v-if="!projectAsideVisible" />
    <float-details v-if="!tasksOutlineVisible" />
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useViewStore } from '@/stores'
import { TagColorSelectDialog } from '@nao-todo/components'
import {
    useTasksDialogStore,
    useTasksHandlerStore,
    useTasksLayoutStore,
    useTasksViewStore
} from '.'
import { NaoDialogManager } from '@/layouts/dialog-manager'
import { CreateProjectDialog, CreateTagDialog, CreateTodoDialog } from '@/layers'
import { IndexAside, TasksDetails, TasksMultiSelect } from './components'
import FloatAside from './components/aside/float-aside.vue'
import FloatDetails from './components/outlines/details/float-details.vue'

const viewStore = useViewStore()
const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()
const tasksHandlerStore = useTasksHandlerStore()
const tasksLayoutStore = useTasksLayoutStore()

const { projectAsideVisible, responsiveFlag, tasksOutlineVisible } = storeToRefs(viewStore)
const { asideWidth, outlineWidth } = storeToRefs(tasksLayoutStore)
const createProjectDialogRef = ref<InstanceType<typeof CreateProjectDialog>>()
const createTodoDialogRef = ref<InstanceType<typeof CreateTodoDialog>>()
const createTagDialogRef = ref<InstanceType<typeof CreateTagDialog>>()
const tagColorSelectDialogRef = ref<InstanceType<typeof TagColorSelectDialog>>()
const naoDialogManagerRef = ref<InstanceType<typeof NaoDialogManager>>()

// 挂载后钩子 -> 注册对话框
onMounted(() => {
    tasksDialogStore.createProjectDialogRef = createProjectDialogRef.value
    tasksDialogStore.createTodoDialogRef = createTodoDialogRef.value
    tasksDialogStore.createTagDialogRef = createTagDialogRef.value
    tasksDialogStore.tagColorSelectDialogRef = tagColorSelectDialogRef.value
    tasksDialogStore.dialogManagerRef = naoDialogManagerRef.value
})
</script>
