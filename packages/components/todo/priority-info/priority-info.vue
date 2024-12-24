<template>
    <nue-div align="center" gap="4px" wrap="nowrap">
        <nue-icon :name="info[0]" style="--icon-weight: normal" :color="color" />
        <nue-text :clamped="useClamped ? 1 : void 0" :color="color" size="12px">
            {{ info[1] }}
        </nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Todo } from '@nao-todo/types'

const props = defineProps<{
    priority: Todo['priority']
    colored?: boolean
    useClamped?: boolean
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
