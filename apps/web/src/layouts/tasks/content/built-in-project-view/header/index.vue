<script setup lang="ts">
import { inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useTasksViewStore, useTasksDialogStore } from '@/views/tasks'
import { TasksTodoFilterDropdown } from '@/components/tasks/dropdowns'
import operationDropdown from './operation-dropdown.vue'
import useHeader from './use-header'
import { type TasksProjectViewContext, TASKS_PROJECT_VIEW_CONTEXT_KEY } from '../use-project-view'

defineOptions({ name: 'TasksMainProjectHeader' })
defineProps<{ projectId?: string; viewType?: string; todoId?: string }>()

const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()
const tasksProjectViewContext = inject<TasksProjectViewContext>(TASKS_PROJECT_VIEW_CONTEXT_KEY)

const {
    viewContext,
    columnsDropdownOptions,
    switchViewTypeToTable,
    switchViewTypeToKanban,
    switchViewTypeToList,
    savePreference
} = useHeader()
const { isDisplayAside } = storeToRefs(tasksViewStore)

const openTodoCreator = () => {
    if (!tasksDialogStore.todoCreator) return
    tasksDialogStore.todoCreator.open?.({ projectId: tasksProjectViewContext!.project.value!.id })
}
</script>

<template>
    <nue-div v-if="tasksProjectViewContext" theme="tasks-header">
        <nue-div align="center">
            <nue-div align="center" flex="1">
                <nue-button
                    :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                    theme="icon,ghost"
                    @click="tasksViewStore.isDisplayAside = !tasksViewStore.isDisplayAside"
                />
                <nue-text theme="pointer,tasks-header__name">
                    {{ tasksProjectViewContext.project.value!.name }}
                </nue-text>
            </nue-div>
            <nue-div align="center">
                <nue-tooltip content="新增待办" size="small" @click="openTodoCreator">
                    <nue-button icon="plus" theme="icon,ghost" />
                </nue-tooltip>
                <tasks-todo-filter-dropdown />
                <operation-dropdown />
            </nue-div>
        </nue-div>
    </nue-div>
</template>
