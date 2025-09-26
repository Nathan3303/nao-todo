<script setup lang="ts">
import { useTasksViewStore, useTasksDialogStore } from '@/stores/tasks'
import { storeToRefs } from 'pinia'
import TasksMainBasicOperationsDropdown from './operations-dropdown.vue'

defineOptions({ name: 'TasksMainBasicViewHeader' })

const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()

const { viewProps } = storeToRefs(tasksViewStore)

const openTodoCreator = () => {
    if (!tasksDialogStore.todoCreator) return
    tasksDialogStore.todoCreator.open({ ...viewProps.value!.createTodoOptions })
}
</script>

<template>
    <nue-div vertical gap="0.5rem" v-if="viewProps">
        <nue-div wrap="nowrap" align="center">
            <nue-div flex="1" wrap="nowrap" align="center">
                <nue-button :icon="'menu-open' as never" theme="icon,ghost" />
                <nue-text :clamped="1" theme="pointer" size="var(--nue-text-xxl)">
                    {{ viewProps.name }}
                </nue-text>
            </nue-div>
            <nue-div wrap="nowrap" align="center" width="fit-content">
                <nue-tooltip
                    content="查看并顺延已过期的待办"
                    size="small"
                    v-if="viewProps.id === 'today'"
                >
                    <nue-button icon="history" theme="icon,ghost" />
                </nue-tooltip>
                <nue-tooltip content="新增待办" size="small" @click="openTodoCreator">
                    <nue-button icon="plus" theme="icon,ghost" />
                </nue-tooltip>
                <tasks-main-basic-operations-dropdown />
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<style scoped></style>
