<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTasksViewStore, useTasksDialogStore } from '@/stores/tasks'
import TasksMainTagOperationsDropdown from './operations-dropdown.vue'

defineOptions({ name: 'TasksMainTagViewHeader' })

const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()

const { viewProps } = storeToRefs(tasksViewStore)

const openTodoCreator = () => {
    if (!tasksDialogStore.todoCreator) return
    tasksDialogStore.todoCreator.open({ tags: [viewProps.value!.id] })
}
</script>

<template>
    <nue-div vertical gap="0.5rem" v-if="viewProps">
        <nue-div wrap="nowrap" align="center">
            <nue-div flex="1" wrap="nowrap" align="center">
                <nue-button :icon="'menu-open' as never" theme="icon,ghost" />
                <nue-text
                    :clamped="1"
                    size="var(--nue-text-xxl)"
                    style="cursor: pointer"
                    @click="() => tasksViewStore.showTagNameUpdater(viewProps!.id)"
                >
                    {{ viewProps.name }}
                </nue-text>
            </nue-div>
            <nue-div wrap="nowrap" align="center" width="fit-content">
                <nue-tooltip content="新增待办" size="small" @click="openTodoCreator">
                    <nue-button icon="plus" theme="icon,ghost" />
                </nue-tooltip>
                <tasks-main-tag-operations-dropdown />
            </nue-div>
        </nue-div>
        <nue-text
            :clamped="2"
            color="var(--nue-primary-color-500)"
            size="var(--nue-text-sm)"
            style="cursor: pointer"
            @click="() => tasksViewStore.showTagDescriptionUpdater(viewProps!.id)"
        >
            {{ viewProps.description }}
        </nue-text>
    </nue-div>
</template>

<style scoped></style>
