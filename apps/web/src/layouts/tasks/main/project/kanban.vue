<script setup lang="ts">
import { useTasksViewStore } from '@/stores/tasks'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksMainProjectViewKanban' })

const tasksViewStore = useTasksViewStore()

const { viewProps } = storeToRefs(tasksViewStore)
</script>

<template>
    <nue-div v-if="viewProps">
        {{ viewProps.category }} : {{ viewProps.id }}
    </nue-div>
</template>

<style scoped></style>
