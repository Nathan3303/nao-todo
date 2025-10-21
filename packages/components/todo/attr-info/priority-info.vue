<script setup lang="ts">
import { computed } from 'vue'
import TodoBasicInfo from './basic-info.vue'
import type { Todo } from '@nao-todo/types'

defineOptions({ name: 'TodoPriorityInfo' })
const props = defineProps<{
    priority: string
    colored?: boolean
    useClamped?: boolean
}>()

const priorityInfos = {
    urgent: ['priority-3', '高优先级', 'red'],
    high: ['priority-3', '高优先级', 'red'],
    medium: ['priority-2', '中优先级', 'orange'],
    low: ['priority-1', '低优先级', '#6363ff'],
    none: ['priority-1', '无优先级', 'gray']
}

const info = computed(() => {
    return priorityInfos[props.priority as Todo['priority']]
})
</script>

<template>
    <todo-basic-info :icon="info[0]" :text="info[1]" :clamped="useClamped ? 1 : void 0" />
</template>

