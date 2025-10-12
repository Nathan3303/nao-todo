<script setup lang="ts">
import TasksAside from './aside.vue'
import TasksFloatAside from './float-aside.vue'
import { useTasksViewStore } from '@/stores/tasks'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksAsideWrapper' })

const tasksViewStore = useTasksViewStore()

const { responsiveFlag, asideWidth, isDisplayAside } = storeToRefs(tasksViewStore)
</script>

<template>
    <tasks-float-aside v-if="responsiveFlag < 2" />
    <template v-else-if="isDisplayAside">
        <tasks-aside :width="asideWidth" max-width="256px" min-width="180px" />
        <nue-separator op-target="previous" @resize="tasksViewStore.handleAsideResize" />
    </template>
</template>
