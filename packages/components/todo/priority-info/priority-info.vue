<template>
    <nue-div align="center" style="width: 50px" gap="4px">
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
            return ['priority-3', '高', 'red']
        case 'medium':
            return ['priority-2', '中', 'orange']
        case 'low':
            return ['priority-1', '低', '#6363ff']
        default:
            return ['priority-1', '无', 'gray']
    }
})

const color = computed(() => {
    return props.colored ? info.value[2] : void 0
})
</script>
