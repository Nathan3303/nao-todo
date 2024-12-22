<template>
    <todo-view-kanban
        :key="viewInfo?.id"
        :base-route="baseRoute"
        :disabledCreateTodo="category === 'basic' && viewInfo?.id === 'recycle'"
    />
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { TodoViewKanban } from '@/layers'
import { storeToRefs } from 'pinia'
import { useTasksViewStore } from '..'

const tasksViewStore = useTasksViewStore()

const { viewInfo, category } = storeToRefs(tasksViewStore)

const baseRoute = computed(() => {
    switch (category.value) {
        case 'basic':
            return `tasks-${viewInfo.value?.id}-kanban`
        case 'project':
            return `tasks-project-kanban`
        case 'tag':
            return `tasks-tag-kanban`
        default:
            return `tasks-all-kanban`
    }
})
</script>
