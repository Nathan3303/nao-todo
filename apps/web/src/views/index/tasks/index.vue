<template>
    <nue-container class="tasks-view" theme="vertical,inner">
        <nue-main
            :allow-collapse-aside="false"
            :allow-collapse-outline="false"
            :allow-hide-aside="false"
            :allow-resize-aside="responsiveFlag > 1"
            aside-max-width="300px"
            aside-min-width="200px"
            aside-width="250px"
            class="tasks-view__main"
            outline-max-width="540px"
            outline-min-width="375px"
            outline-width="480px"
        >
            <template v-if="projectAsideVisible" #aside>
                <aside-link icon="more2" route-name="tasks-all">所有</aside-link>
                <aside-link icon="calendar2" route-name="tasks-today">
                    今天 - {{ now.format('MM月DD日, dddd') }}
                </aside-link>
                <aside-link icon="tomorrow2" route-name="tasks-tomorrow">明天</aside-link>
                <aside-link icon="week3" route-name="tasks-week">本周</aside-link>
                <aside-link icon="inbox" route-name="tasks-inbox">收集箱</aside-link>
                <nue-divider />
                <nue-collapse v-model="collapseItemsRecord">
                    <project-smart-list />
                    <tag-smart-list />
                </nue-collapse>
                <nue-divider />
                <aside-link icon="heart" route-name="tasks-favorite">已收藏</aside-link>
                <aside-link icon="delete" route-name="tasks-recycle">垃圾桶</aside-link>
            </template>
            <template #content>
                <suspense>
                    <router-view />
                </suspense>
            </template>
            <template v-if="tasksOutlineVisible" #outline>
                <todo-multi-details
                    v-if="tasksViewStore.multiSelectStates.isShowMultiDetails"
                    :selected-ids="tasksViewStore.multiSelectStates.selectedTodoIds"
                />
                <todo-details-v2 v-else />
            </template>
            <!-- Outline Drawer (For mobile device) -->
            <nue-drawer
                v-if="!tasksOutlineVisible"
                v-model:visible="outlineDrawerVisible"
                class="nue-drawer--no-header nue-drawer--tasks-outline"
                min-span="375px"
                span="480px"
            >
                <todo-details-v2 />
            </nue-drawer>
        </nue-main>
    </nue-container>
    <!-- Dialogs -->
    <project-manager ref="projectManagerRef" />
    <tag-manager ref="tagManagerRef" />
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
    <todo-history-dialog ref="todoHistoryDialogRef" />
</template>

<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useViewStore } from '@/stores'
import { AsideLink, TagColorSelectDialog } from '@nao-todo/components'
import { useMoment } from '@nao-todo/utils'
import { useTasksDialogStore, useTasksHandlerStore, useTasksViewStore } from '.'
import {
    CreateProjectDialog,
    CreateTagDialog,
    CreateTodoDialog,
    ProjectManager,
    ProjectSmartList,
    TagManager,
    TagSmartList,
    TodoDetailsV2,
    TodoMultiDetails,
    TodoHistoryDialog
} from '@/layers'

const route = useRoute()
const viewStore = useViewStore()
const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()
const tasksHandlerStore = useTasksHandlerStore()

const now = useMoment()
const { projectAsideVisible, responsiveFlag, tasksOutlineVisible } = storeToRefs(viewStore)
const projectManagerRef = ref<InstanceType<typeof ProjectManager>>()
const tagManagerRef = ref<InstanceType<typeof TagManager>>()
const createProjectDialogRef = ref<InstanceType<typeof CreateProjectDialog>>()
const createTodoDialogRef = ref<InstanceType<typeof CreateTodoDialog>>()
const createTagDialogRef = ref<InstanceType<typeof CreateTagDialog>>()
const tagColorSelectDialogRef = ref<InstanceType<typeof TagColorSelectDialog>>()
const todoHistoryDialogRef = ref<InstanceType<typeof TodoHistoryDialog>>()
const collapseItemsRecord = ref(['projects', 'tags'])
const outlineDrawerVisible = ref(false)

// 挂载后钩子 -> 注册对话框
onMounted(() => {
    tasksDialogStore.projectManagerRef = projectManagerRef.value
    tasksDialogStore.tagManagerRef = tagManagerRef.value
    tasksDialogStore.createProjectDialogRef = createProjectDialogRef.value
    tasksDialogStore.createTodoDialogRef = createTodoDialogRef.value
    tasksDialogStore.createTagDialogRef = createTagDialogRef.value
    tasksDialogStore.tagColorSelectDialogRef = tagColorSelectDialogRef.value
    tasksDialogStore.todoHistoryDialogRef = todoHistoryDialogRef.value
})

watch(
    () => route.params.taskId,
    (newTasksId) => (outlineDrawerVisible.value = !!newTasksId),
    { immediate: true }
)
</script>