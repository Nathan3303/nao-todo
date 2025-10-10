<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useTasksViewStore, useTasksDialogStore } from '@/stores/tasks'
import TasksMainBasicOperationsDropdown from './dropdowns/operations.vue'
import TasksMainFilterDropdown from '@/components/tasks/dropdowns/filter-dropdown.vue'

defineOptions({ name: 'TasksMainBasicViewHeader' })

const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()

const { viewProps, isDisplayAside } = storeToRefs(tasksViewStore)

const hideAsideButtonIcon = computed(() => {
    return (isDisplayAside.value ? 'menu-close' : 'menu-open') as never
})

const openTodoCreator = () => {
    if (!tasksDialogStore.todoCreator) return
    tasksDialogStore.todoCreator.open({ ...viewProps.value!.createTodoOptions })
}
</script>

<template>
    <nue-div vertical gap="0.5rem" v-if="viewProps">
        <nue-div wrap="nowrap" align="center">
            <nue-div flex="1" wrap="nowrap" align="center">
                <nue-button
                    :icon="hideAsideButtonIcon"
                    theme="icon,ghost"
                    @click="tasksViewStore.switchIsDisplayAside"
                />
                <nue-text :clamped="1" theme="pointer" size="var(--nue-text-xxl)">
                    {{ viewProps.name }}
                </nue-text>
            </nue-div>
            <nue-div wrap="nowrap" align="center" width="fit-content">
                <nue-tooltip
                    v-if="!['favorite', 'recycle', 'givenup'].includes(viewProps.id)"
                    content="新增待办"
                    size="small"
                    @click="openTodoCreator"
                >
                    <nue-button icon="plus" theme="icon,ghost" />
                </nue-tooltip>
                <tasks-main-filter-dropdown />
                <tasks-main-basic-operations-dropdown />
            </nue-div>
        </nue-div>
        <nue-text
            v-if="viewProps.description"
            :clamped="2"
            color="var(--nue-primary-color-500)"
            size="var(--nue-text-sm)"
        >
            {{ viewProps.description }}
        </nue-text>
    </nue-div>
</template>

<style scoped></style>
