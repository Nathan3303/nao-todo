<script setup lang="ts">
import { computed } from 'vue'
import TableView from './table/index.vue'

defineOptions({
    name: 'TasksMainProjectContent',
    components: {
        'table-view': TableView
    }
})
const props = defineProps<{ viewType: string }>()

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
