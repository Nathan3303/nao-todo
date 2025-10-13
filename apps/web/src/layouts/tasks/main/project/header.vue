<script setup lang="ts">
import { useTasksViewStore, useTasksDialogStore, useTasksProjectViewStore } from '@/stores/tasks'
import { storeToRefs } from 'pinia'
import {
    TasksProjectViewOperationsDropdown,
    TasksTodoFilterDropdown
} from '@/components/tasks/dropdowns'
import { computed } from 'vue'

defineOptions({ name: 'TasksMainProjectHeader' })
defineProps<{ projectId?: string; viewType?: string; todoId?: string }>()

const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()
const tasksProjectViewStore = useTasksProjectViewStore()

const { viewProps, isDisplayAside } = storeToRefs(tasksViewStore)

const hideAsideButtonIcon = computed(() => {
    return (isDisplayAside.value ? 'menu-close' : 'menu-open') as never
})

const openTodoCreator = () => {
    if (!tasksDialogStore.todoCreator) return
    tasksDialogStore.todoCreator.open({ projectId: viewProps.value!.id })
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
                <tasks-todo-filter-dropdown @get-todos="tasksProjectViewStore.getTodos" />
                <tasks-project-view-operations-dropdown />
            </nue-div>
        </nue-div>
        <nue-text
            :clamped="2"
            color="var(--nue-primary-color-500)"
            size="var(--nue-text-sm)"
            style="cursor: pointer"
            @click="() => tasksViewStore.showProjectDescriptionUpdater(viewProps!.id)"
        >
            {{ viewProps.description || '设置清单描述' }}
        </nue-text>
    </nue-div>
</template>
