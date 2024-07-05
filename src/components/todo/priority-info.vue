<template>
    <nue-div align="center" style="width: 72px" gap="4px">
        <nue-icon :name="info[0]" style="--icon-weight: normal"></nue-icon>
        <nue-text size="12px">{{ info[1] }}</nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Todo } from '@/stores/use-todo-store'

const props = defineProps<{ priority: Todo['priority'] }>()

const info = computed(() => {
    const { priority } = props
    switch (priority) {
        case 'high':
            return ['priority-3', 'High']
        case 'medium':
            return ['priority-2', 'Medium']
        case 'low':
            return ['priority-1', 'Low']
        default:
            return ['priority-1', 'Low']
    }
})
</script>
