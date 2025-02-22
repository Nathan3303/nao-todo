<script lang="ts" setup>
import { computed } from 'vue'
import NuemIcon from '@/ui/icon.vue'
import type { Todo } from '@nao-todo/types'

defineOptions({ name: 'TodoPriorityInfo' })
const props = defineProps<{ priority?: Todo['priority'] }>()

const info = computed(() => {
    switch (props.priority) {
        case 'high':
            return ['priority-3', '高优先级', 'red']
        case 'medium':
            return ['priority-2', '中优先级', 'orange']
        case 'low':
            return ['priority-1', '低优先级', '#6363ff']
        default:
            return ['priority-1', '', 'gray']
    }
})
</script>

<template>
    <view class="todo-priority-info">
        <nuem-icon :name="info[0]" />
        <text v-if="info[1]">{{ info[1] }}</text>
    </view>
</template>

<style scoped>
.todo-priority-info {
    display: flex;
    gap: 0.25rem;
    align-items: center;
    --icon-size: var(--text-md);
    --icon-color: var(--primary-color-700);
    font-size: var(--text-xs);
}
</style>
