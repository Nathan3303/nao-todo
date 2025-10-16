<script setup lang="ts">
import { TasksTodoDetails, TasksFloatTodoDetails } from './details'
import { useTasksViewStore } from '@/stores/tasks'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksOutline' })

const tasksViewStore = useTasksViewStore()

const { isUseFloatOutline, outlineWidth } = storeToRefs(tasksViewStore)
</script>

<template>
    <tasks-float-todo-details v-if="isUseFloatOutline" />
    <template v-else>
        <nue-separator op-target="next" @resize="tasksViewStore.handleOutlineResize" />
        <nue-aside :width="outlineWidth" max-width="420px" min-width="360px" style="padding: 0">
            <tasks-todo-details />
        </nue-aside>
    </template>
</template>

<style scoped></style>
