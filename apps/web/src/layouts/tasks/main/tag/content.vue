<script setup lang="ts">
import { computed } from 'vue'
import TableView from './table.vue'
import KanbanView from './kanban.vue'

defineOptions({
    name: 'TasksMainTagContent',
    components: {
        'table-view': TableView,
        'kanban-view': KanbanView
    }
})
const props = defineProps<{ tagId?: string; viewType?: string; todoId?: string }>()

const componentName = computed(() => {
    const viewType = props.viewType || 'table'
    return `${viewType}-view`
})
</script>

<template>
    <component :is="componentName" />
</template>
