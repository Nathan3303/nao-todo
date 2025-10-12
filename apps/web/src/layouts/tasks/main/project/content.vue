<script setup lang="ts">
import { computed } from 'vue'
import TableView from './table.vue'
import KanbanView from './kanban.vue'

defineOptions({
    name: 'TasksMainProjectContent',
    components: {
        'table-view': TableView,
        'kanban-view': KanbanView
    }
})
const props = defineProps<{ projectId?: string; viewType?: string; todoId?: string }>()

const componentName = computed(() => {
    const viewType = props.viewType || 'table'
    return `${viewType}-view`
})
</script>

<template>
    <component :is="componentName" />
</template>
