<script setup lang="ts">
import TasksAside from './aside.vue'
import TasksFloatAside from './float-aside.vue'
import useTasksViewStore from '@/views/tasks/tasks-view-store'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksAsideWrapper' })

const tasksViewStore = useTasksViewStore()

const { isDisplayAside, asideWidth, isUseFloatAside } = storeToRefs(tasksViewStore)
</script>

<template>
    <tasks-float-aside v-if="isUseFloatAside" />
    <template v-else-if="isDisplayAside">
        <tasks-aside :width="asideWidth" max-width="256px" min-width="180px" />
        <nue-separator op-target="previous" @resize="tasksViewStore.handleResizeAside" />
    </template>
</template>
