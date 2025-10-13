<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTasksViewStore, useTasksDialogStore, useTasksTagViewStore } from '@/stores/tasks'
import { TasksTagViewOperationsDropdown, TasksTodoFilterDropdown } from '@/components/tasks'
import { computed } from 'vue'

defineOptions({ name: 'TasksMainTagHeader' })
defineProps<{ tagId?: string; viewType?: string; todoId?: string }>()

const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()
const tasksTagViewStore = useTasksTagViewStore()

const { viewProps, isDisplayAside } = storeToRefs(tasksViewStore)

const hideAsideButtonIcon = computed(() => {
    return (isDisplayAside.value ? 'menu-close' : 'menu-open') as never
})

const openTodoCreator = () => {
    if (!tasksDialogStore.todoCreator) return
    tasksDialogStore.todoCreator.open({ tags: [viewProps.value!.id] })
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
                    @click="() => tasksViewStore.showTagNameUpdater(viewProps!.id)"
                >
                    {{ viewProps.name }}
                </nue-text>
            </nue-div>
            <nue-div wrap="nowrap" align="center" width="fit-content">
                <nue-tooltip content="新增待办" size="small" @click="openTodoCreator">
                    <nue-button icon="plus" theme="icon,ghost" />
                </nue-tooltip>
                <tasks-todo-filter-dropdown @get-todos="tasksTagViewStore.getTodos" />
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

<style scoped></style>
