<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTasksViewStore, useTasksDialogStore } from '@/stores/tasks'
import { TasksTagViewOperationsDropdown, TasksTodoFilterDropdown } from '@/components/tasks'
import { computed } from 'vue'

defineOptions({ name: 'TasksMainTagHeader' })
defineProps<{ tagId?: string; viewType?: string; todoId?: string }>()

const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()

const { viewProps, isDisplayAside } = storeToRefs(tasksViewStore)

const hideAsideButtonIcon = computed(() => {
    return (isDisplayAside.value ? 'menu-close' : 'menu-open') as never
})

const openTodoCreator = () => {
    if (!tasksDialogStore.todoCreator) return
    tasksDialogStore.todoCreator.open?.({ tags: [viewProps.value!.id] })
}
</script>

<template>
    <nue-div v-if="viewProps" vertical gap=".5rem" width="100%">
        <nue-div align="center">
            <nue-div align="center" flex="1">
                <nue-button
                    :icon="hideAsideButtonIcon"
                    theme="icon,ghost"
                    @click="tasksViewStore.switchIsDisplayAside"
                />
                <nue-text
                    :clamped="1"
                    size="var(--nue-text-xxl)"
                    style="cursor: pointer"
                    @click="() => tasksViewStore.showTagNameUpdater(viewProps!.id)"
                >
                    # {{ viewProps.name }}
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
            :clamped="2"
            color="var(--nue-primary-color-500)"
            size="var(--nue-text-sm)"
            style="cursor: pointer"
            @click="() => tasksViewStore.showTagDescriptionUpdater(viewProps!.id)"
        >
            {{ viewProps.description || '设置标签描述' }}
        </nue-text>
    </nue-div>
</template>
