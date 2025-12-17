<script setup lang="ts">
import { useTasksViewStore, useTasksDialogStore } from '@/stores/tasks'
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

const { viewProps, isDisplayAside } = storeToRefs(tasksViewStore)

const hideAsideButtonIcon = computed(() => {
    return (isDisplayAside.value ? 'menu-close' : 'menu-open') as never
})

const openTodoCreator = () => {
    if (!tasksDialogStore.todoCreator) return
    tasksDialogStore.todoCreator.open?.({ projectId: viewProps.value!.id })
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
                <nue-text
                    theme="pointer,tasks-header__name"
                    @click="() => tasksViewStore.showProjectNameUpdater(viewProps!.id)"
                >
                    {{ viewProps.name }}
                </nue-text>
            </nue-div>
            <nue-div align="center">
                <nue-tooltip content="新增待办" size="small" @click="openTodoCreator">
                    <nue-button icon="plus" theme="icon,ghost" />
                </nue-tooltip>
                <tasks-todo-filter-dropdown />
                <tasks-project-view-operations-dropdown />
            </nue-div>
        </nue-div>
        <nue-text
            theme="pointer,tasks-header__description"
            @click="() => tasksViewStore.showProjectDescriptionUpdater(viewProps!.id)"
        >
            {{ viewProps.description || '该清单没有设置描述信息，点此设置清单描述' }}
        </nue-text>
    </nue-div>
</template>

