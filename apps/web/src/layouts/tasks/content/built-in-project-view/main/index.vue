<script setup lang="ts">
import { computed } from 'vue'
import useContent, { type TasksProjectViewContentProps } from './use-content'
import TableView from './table.vue'
import KanbanView from './kanban.vue'
import ListView from './list.vue'

defineOptions({
    name: 'TasksMainProjectContent',
    components: {
        'table-view': TableView,
        'kanban-view': KanbanView,
        'list-view': ListView
    }
})
const props = defineProps<TasksProjectViewContentProps>()
useContent()

const componentName = computed(() => {
    const viewType = props.viewType || 'table'
    return `${viewType}-view`
})
</script>

<template>
    <nue-main>
        <nue-content fill overflow="hidden">
            <component :is="componentName" />
        </nue-content>
    </nue-main>
</template>
