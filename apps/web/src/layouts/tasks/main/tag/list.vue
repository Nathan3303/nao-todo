<script setup lang="ts">
import { useTasksViewStore } from '@/stores/tasks'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksMainTagViewList' })

const tasksViewStore = useTasksViewStore()

const { viewProps } = storeToRefs(tasksViewStore)
</script>

<template>
    <nue-div v-if="viewProps"> {{ viewProps.category }} : {{ viewProps.id }} : ListView </nue-div>
</template>

<style scoped></style>
