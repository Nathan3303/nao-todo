<script setup lang="ts">
import { useTasksViewStore, useTasksDialogStore } from '@/views/tasks'
import { storeToRefs } from 'pinia'
import {
    TasksProjectViewOperationsDropdown,
    TasksTodoFilterDropdown
} from '@/components/tasks/dropdowns'
import { inject, computed } from 'vue'
import { type TasksProjectViewContext, TASKS_PROJECT_VIEW_CONTEXT_KEY } from './use-project-view'

defineOptions({ name: 'TasksMainProjectHeader' })
defineProps<{ projectId?: string; viewType?: string; todoId?: string }>()

const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()
const tasksProjectViewContext = inject<TasksProjectViewContext>(TASKS_PROJECT_VIEW_CONTEXT_KEY)

const { isDisplayAside } = storeToRefs(tasksViewStore)

const hideAsideButtonIcon = computed(() => {
    return (isDisplayAside.value ? 'menu-close' : 'menu-open') as never
})

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
                    :icon="hideAsideButtonIcon"
                    theme="icon,ghost"
                    @click="tasksViewStore.switchIsDisplayAside"
                />
                <nue-text
                    theme="pointer,tasks-header__name"
                    @click="
                        () =>
                            tasksViewStore.showProjectNameUpdater(
                                tasksProjectViewContext!.project.value!.id
                            )
                    "
                >
                    {{ tasksProjectViewContext.project.value!.name }}
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
            @click="
                () =>
                    tasksViewStore.showProjectDescriptionUpdater(
                        tasksProjectViewContext!.project.value!.id
                    )
            "
        >
            {{
                tasksProjectViewContext.project.value!.description ||
                '该清单没有设置描述信息，点此设置清单描述'
            }}
        </nue-text>
    </nue-div>
</template>
