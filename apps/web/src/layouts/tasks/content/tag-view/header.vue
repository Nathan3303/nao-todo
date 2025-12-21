<script setup lang="ts">
import { useTasksViewStore, useTasksDialogStore } from '@/views/tasks'
import { storeToRefs } from 'pinia'
import { TasksTagViewOperationsDropdown, TasksTodoFilterDropdown } from '@/components/tasks'
import { inject, computed } from 'vue'
import { type TasksTagViewContext, TASKS_TAG_VIEW_CONTEXT_KEY } from './use-tag-view'

defineOptions({ name: 'TasksMainTagHeader' })
defineProps<{ tagId?: string; viewType?: string; todoId?: string }>()

const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()
const tasksTagViewContext = inject<TasksTagViewContext>(TASKS_TAG_VIEW_CONTEXT_KEY)

const { isDisplayAside } = storeToRefs(tasksViewStore)

const hideAsideButtonIcon = computed(() => {
    return (isDisplayAside.value ? 'menu-close' : 'menu-open') as never
})

const openTodoCreator = () => {
    if (!tasksDialogStore.todoCreator) return
    tasksDialogStore.todoCreator.open?.({ tags: [tasksTagViewContext!.tag.value!.id] })
}
</script>

<template>
    <nue-div v-if="tasksTagViewContext" theme="tasks-header">
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
                        () => tasksViewStore.showTagNameUpdater(tasksTagViewContext!.tag.value!.id)
                    "
                >
                    # {{ tasksTagViewContext.tag.value!.name }}
                </nue-text>
            </nue-div>
            <nue-div align="center">
                <nue-tooltip content="新增待办" size="small" @click="openTodoCreator">
                    <nue-button icon="plus" theme="icon,ghost" />
                </nue-tooltip>
                <tasks-todo-filter-dropdown />
                <tasks-tag-view-operations-dropdown />
            </nue-div>
        </nue-div>
        <nue-text
            theme="pointer,tasks-header__description"
            @click="
                () => tasksViewStore.showTagDescriptionUpdater(tasksTagViewContext!.tag.value!.id)
            "
        >
            {{ tasksTagViewContext.tag.value!.description || '设置标签描述' }}
        </nue-text>
    </nue-div>
</template>
