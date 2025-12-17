<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTasksViewStore, useTasksDialogStore } from '@/stores/tasks'
import {
    TasksTodoFilterDropdown,
    TasksBasicViewOperationsDropdown
} from '@/components/tasks/dropdowns'

defineOptions({ name: 'TasksMainBasicHeader' })
defineProps<{ viewId?: string; viewType?: string; todoId?: string }>()

const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()

const { viewProps, isDisplayAside } = storeToRefs(tasksViewStore)

const hideAsideButtonIcon = computed(() => {
    return (isDisplayAside.value ? 'menu-close' : 'menu-open') as never
})

const isCreatable = computed(() => {
    return !['overdue', 'favorite', 'recycle', 'givenup'].includes(viewProps.value!.id)
})

const openTodoCreator = () => {
    tasksDialogStore.todoCreator?.open?.({ ...viewProps.value!.createTodoOptions })
}
</script>

<template>
    <nue-div v-if="viewProps" theme="tasks-header">
        <nue-div align="center">
            <nue-div align="center" flex="1">
                <nue-button
                    :icon="hideAsideButtonIcon"
                    theme="icon,ghost"
                    @click="tasksViewStore.switchIsDisplayAside"
                />
                <nue-text theme="pointer,tasks-header__name">
                    {{ viewProps.name }}
                </nue-text>
            </nue-div>
            <nue-div align="center">
                <nue-tooltip
                    v-if="isCreatable"
                    content="新增待办"
                    size="small"
                    @click="openTodoCreator"
                >
                    <nue-button icon="plus" theme="icon,ghost" />
                </nue-tooltip>
                <tasks-todo-filter-dropdown />
                <tasks-basic-view-operations-dropdown />
            </nue-div>
        </nue-div>
        <nue-text v-if="viewProps.description" theme="tasks-header__description">
            {{ viewProps.description }}
        </nue-text>
    </nue-div>
</template>

