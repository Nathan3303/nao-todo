<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { PomodoroRecordViewObject } from '../timer/types'

defineOptions({ name: 'PomodoroRecordsCompRow' })

// @props
const props = defineProps<{
    record: PomodoroRecordViewObject
}>()

// @computed 格式化时长显示
const displayDuration = computed(() => {
    const start = dayjs(props.record.startAt)
    const end = dayjs(props.record.endAt)
    const startStr = start.format('HH:mm')
    const endStr = end.format('HH:mm')
    const minutes = Math.round(props.record.duration / 60)
    if (minutes < 60) {
        return `${startStr} - ${endStr} , ${minutes}m`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${startStr} - ${endStr} , ${hours}h ${mins}m`
})
</script>

<template>
    <nue-div theme="card,pomodoro-records-row">
        <nue-text theme="title" :clamped="1">{{ record.name }}</nue-text>
        <nue-text theme="duration">{{ displayDuration }}</nue-text>
    </nue-div>
</template>

<style scoped>
.nue-div--pomodoro-records-row {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-2xs);
    box-shadow: none;
    padding: var(--nue-padding-xs);
    border: none;
    background-color: var(--nue-primary-color-100);
    width: 100%;
    justify-content: space-between;

    > .nue-text--title {
        font-size: var(--nue-text-sm);
        font-weight: 500;
    }

    > .nue-text--duration {
        font-size: var(--nue-text-sm);
        color: var(--nue-primary-color-500);
        flex: none;
    }
}
</style>
