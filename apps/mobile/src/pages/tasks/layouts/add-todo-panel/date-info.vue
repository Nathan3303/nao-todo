<script lang="ts" setup>
import { computed } from 'vue'
import NuemIcon from '@/ui/icon.vue'
import { useRelativeDate } from '@nao-todo/hooks'
import { useMoment } from '@nao-todo/utils'
import type { Todo } from '@nao-todo/types'

defineOptions({ name: 'TodoDateInfo' })
const props = defineProps<{ date?: Todo['dueDate']['endAt'] }>()

const text = computed(() => {
    return props.date ? useRelativeDate(useMoment(props.date)) : ''
})
</script>

<template>
    <view class="todo-date-info">
        <nuem-icon name="calendar" />
        <text v-if="text">{{ text }}</text>
    </view>
</template>

<style scoped>
.todo-date-info {
    display: flex;
    gap: 0.25rem;
    align-items: center;
    --icon-size: var(--text-md);
    --icon-color: var(--primary-color-700);
    font-size: var(--text-xs);
}
</style>
