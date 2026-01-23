<script setup lang="ts">
import { AppFloatAside } from '@/layouts/app/aside'
import TasksAside from './index.vue'
import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import { inject } from 'vue'

// @context Tasksview 任务视图上下文
const { isDisplayAside } = inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!
</script>

<template>
    <app-float-aside v-model="isDisplayAside">
        <tasks-aside />
    </app-float-aside>
</template>
