<script lang="ts" setup>
import NuemIcon from '@/ui/icon.vue'
import type { Event } from '@nao-todo/types'

defineOptions({ name: 'EventRow' })
defineProps<{
    event?: Event
}>()
</script>

<template>
    <view class="event-row">
        <nuem-icon :name="event?.isDone ? 'square-check-fill' : 'square'" />
        <text class="text--clamped">{{ event?.title }}</text>
        <view class="event-row__actions">
            <nuem-icon name="delete" />
        </view>
    </view>
</template>

<style scoped>
.event-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.event-row__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
}
</style>
