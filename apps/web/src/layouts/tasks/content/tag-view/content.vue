<script setup lang="ts">
// import { computed } from 'vue'
// import TableView from './table.vue'
// import KanbanView from './kanban.vue'
// import ListView from './list.vue'

// defineOptions({
//     name: 'TasksMainTagContent',
//     components: {
//         'table-view': TableView,
//         'kanban-view': KanbanView,
//         'list-view': ListView
//     }
// })
const props = defineProps<{ tagId?: string; viewType?: string; todoId?: string }>()

// const componentName = computed(() => {
//     const viewType = props.viewType || 'table'
//     return `${viewType}-view`
// })
</script>

<template>
    <!-- <component :is="componentName" /> -->
    TagView
</template>
