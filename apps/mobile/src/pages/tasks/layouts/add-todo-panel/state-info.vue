<script lang="ts" setup>
import { computed } from 'vue'
import NuemIcon from '@/ui/icon.vue'
import type { Todo } from '@nao-todo/types'

defineOptions({ name: 'TodoStateInfo' })
const props = defineProps<{ state?: Todo['state'] }>()

const info = computed(() => {
    switch (props.state) {
        case 'todo':
            return ['circle', '待办']
        case 'in-progress':
            return ['in-progress', '正在进行']
        case 'done':
            return ['success-fill', '已完成']
        default:
            return ['circle', '待办']
    }
})
</script>

<template>
    <view class="todo-state-info">
        <nuem-icon :name="info[0]" />
        <text v-if="info[1]">{{ info[1] }}</text>
    </view>
</template>

<style scoped>
.todo-state-info {
    display: flex;
    gap: 0.25rem;
    align-items: center;
    --icon-size: var(--text-md);
    --icon-color: var(--primary-color-700);
    font-size: var(--text-xs);
}
</style>
