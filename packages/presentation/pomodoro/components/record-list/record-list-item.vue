<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { PomodoroRecordViewObject } from '@nao-todo/application/pomodoro/viewobjects'

defineOptions({ name: 'PomodoroRecordsCompRow' })

// @props
const props = defineProps<{ record: PomodoroRecordViewObject }>()

// @computed 格式化时长显示
const displayDuration = computed(() => {
    const totalDuration = props.record.duration
    const hours = Math.floor(totalDuration / 3600)
    const minutes = Math.floor((totalDuration - hours * 3600) / 60)
    const seconds = Math.floor(totalDuration - hours * 3600 - minutes * 60)
    const hoursStr = hours ? `${hours} 时 ` : ''
    const minutesStr = minutes ? `${minutes} 分 ` : ''
    const secondsStr = seconds ? `${seconds} 秒 ` : ''
    return hoursStr + minutesStr + secondsStr
})
</script>

<template>
    <nue-div theme="card,pomodoro-records-row" :data-has-note="!!record.note">
        <nue-div theme="title-and-duration">
            <nue-text theme="task" :clamped="1">{{ record.taskName || '无关联任务' }}</nue-text>
            <nue-text theme="meta">
                {{ record.type === 2 ? '正计时' : '番茄钟' }}，开始于
                {{ dayjs(record.startAt).format('HH:mm') }}，{{ displayDuration }}
            </nue-text>
        </nue-div>
        <nue-text v-if="record.note" theme="note" :clamped="2">{{ record.note }}</nue-text>
    </nue-div>
</template>

<style scoped>
.nue-div--pomodoro-records-row {
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    width: 100%;
    overflow: hidden;
    padding: var(--nue-padding-sm);
    border: none;
    background-color: var(--nue-primary-color-100);
    box-shadow: none;

    > .nue-div--title-and-duration {
        align-items: center;
        justify-content: space-between;
        overflow: hidden;
        gap: var(--nue-gap-2xs);

        > .nue-text--task {
            font-size: var(--nue-text-df2);
            font-weight: 500;
            flex: auto;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
        }

        > .nue-text--meta {
            font-size: var(--nue-text-sm);
            color: var(--nue-primary-color-600);
            flex: none;
            white-space: nowrap;
        }
    }

    > .nue-text--note {
        font-size: var(--nue-text-sm);
        color: var(--nue-primary-color-600);
        word-break: break-word;
    }
}
</style>

