<template>
    <nue-div align="center" style="width: 96px" gap="4px">
        <nue-icon :name="iconName"></nue-icon>
        <nue-text size="12px">{{ priority }}</nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Todo } from '../../stores/useTodoStore'

const props = defineProps<{ priority: Todo['priority'] }>()

const iconName = computed(() => {
    const { priority } = props
    switch (priority) {
        case 'High':
            return 'priority-3'
        case 'Medium':
            return 'priority-2'
        case 'Low':
            return 'priority-1'
    }
})
</script>
