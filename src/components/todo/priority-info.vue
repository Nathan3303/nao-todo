<template>
    <nue-div align="center" style="width: 72px" gap="4px">
        <nue-icon :name="info[0]"></nue-icon>
        <nue-text size="12px">{{ info[1] }}</nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Todo } from '../../stores/use-todo-store'

const props = defineProps<{ priority: Todo['priority'] }>()

const info = computed(() => {
    let { priority } = props
    if (typeof priority !== 'number') {
        priority = parseInt(priority)
    }
    switch (priority) {
        case 2:
            return ['priority-3', 'High']
        case 1:
            return ['priority-2', 'Medium']
        case 0:
            return ['priority-1', 'Low']
        default:
            return ['priority-1', 'Low']
    }
})
</script>
