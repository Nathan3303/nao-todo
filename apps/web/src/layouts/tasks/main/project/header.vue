<script setup lang="ts">
import { useTasksViewStore, useTasksDialogStore } from '@/stores/tasks'
import { storeToRefs } from 'pinia'
import TasksMainProjectOperationsDropdown from './operations-dropdown.vue'

defineOptions({ name: 'TasksMainProjectViewHeader' })

const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()

const { viewProps } = storeToRefs(tasksViewStore)

const openTodoCreator = () => {
    if (!tasksDialogStore.todoCreator) return
    tasksDialogStore.todoCreator.open({ projectId: viewProps.value!.id })
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
                    @click="() => tasksViewStore.showProjectNameUpdater(viewProps!.id)"
                >
                    {{ viewProps.name }}
                </nue-text>
            </nue-div>
            <nue-div wrap="nowrap" align="center" width="fit-content">
                <nue-tooltip content="新增待办" size="small" @click="openTodoCreator">
                    <nue-button icon="plus" theme="icon,ghost" />
                </nue-tooltip>
                <!--                <tasks-filter-dropdown />-->
                <tasks-main-project-operations-dropdown />
            </nue-div>
        </nue-div>
        <nue-text
            :clamped="2"
            color="var(--nue-primary-color-500)"
            size="var(--nue-text-sm)"
            style="cursor: pointer"
            @click="() => tasksViewStore.showProjectDescriptionUpdater(viewProps!.id)"
        >
            {{ viewProps.description }}
        </nue-text>
    </nue-div>
</template>
