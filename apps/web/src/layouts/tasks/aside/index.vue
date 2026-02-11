<script setup lang="ts">
import { inject } from 'vue'
import TasksViewAside from './aside.vue'
import TasksViewAsideDrawer from './float-aside.vue'
import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'

defineOptions({ name: 'TasksViewAsideAdapter' })

const { isDisplayAside, asideWidth, handleResizeAside } =
    inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!
</script>

<template>
    <template v-if="isDisplayAside">
        <tasks-view-aside :width="asideWidth" max-width="360px" min-width="240px" />
        <nue-separator op-target="previous" @resize="handleResizeAside" />
    </template>
    <template v-else>
        <tasks-view-aside-drawer />
    </template>
</template>

<style scoped></style>
