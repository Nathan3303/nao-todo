<script setup lang="ts">
import { computed } from 'vue'
import TasksTableAdapter from './table-adapter.vue'
import TasksKanbanAdapter from './kanban-adapter.vue'
import TasksListAdapter from './list-adapter.vue'

defineOptions({
    name: 'TasksMainProjectContent',
    components: {
        'table-view': TasksTableAdapter,
        'kanban-view': TasksKanbanAdapter,
        'list-view': TasksListAdapter
    }
})
const props = defineProps<{ viewType: string }>()

const componentName = computed(() => `${props.viewType || 'table'}-view`)
</script>

<template>
    <nue-main>
        <nue-content fill overflow="hidden">
            <component :is="componentName" />
        </nue-content>
    </nue-main>
</template>
