<template>
    <nue-div align="center" width="auto" gap="4px">
        <nue-icon :name="info[0]" style="--icon-weight: normal" :color="color" />
        <nue-text size="12px" :color="color">{{ info[1] }}</nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Todo } from '@nao-todo/types'

const props = defineProps<{
    priority: Todo['priority']
    colored?: boolean
}>()

const info = computed(() => {
    switch (props.priority) {
        case 'high':
            return ['priority-3', '高优先级', 'red']
        case 'medium':
            return ['priority-2', '中优先级', 'orange']
        case 'low':
            return ['priority-1', '低优先级', '#6363ff']
        default:
            return ['priority-1', '无优先级', 'gray']
    }
})

const color = computed(() => {
    return props.colored ? info.value[2] : 'var(--primary-color-800)'
})
</script>
