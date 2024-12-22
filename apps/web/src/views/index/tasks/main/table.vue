<template>
    <todo-view-table
        :key="viewInfo?.id"
        :base-route="baseRoute"
        :disabledCreateTodo="category === 'basic' && viewInfo?.id === 'recycle'"
    />
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { TodoViewTable } from '@/layers'
import { storeToRefs } from 'pinia'
import { useTasksViewStore } from '..'

const tasksViewStore = useTasksViewStore()

const { viewInfo, category } = storeToRefs(tasksViewStore)

const baseRoute = computed(() => {
    switch (category.value) {
        case 'basic':
            return `tasks-${viewInfo.value?.id}-table`
        case 'project':
            return `tasks-project-table`
        case 'tag':
            return `tasks-tag-table`
        default:
            return `tasks-all-table`
    }
})
</script>
