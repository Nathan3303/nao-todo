<script setup lang="ts">
import { AppFloatAside } from '@/layouts/app/aside'
import TasksAside from './index.vue'
import { useTasksViewStore } from '@/views/tasks';
import { storeToRefs } from 'pinia';

const tasksViewStore = useTasksViewStore()

const { isDisplayAside } = storeToRefs(tasksViewStore)
</script>

<template>
    <app-float-aside v-model="isDisplayAside">
        <tasks-aside />
    </app-float-aside>
</template>
