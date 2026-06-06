<script setup lang="ts">
import PomodoroRecordsCompRow from './row.vue'
import type { PomodoroRecordViewObject } from '../timer/types'

defineOptions({ name: 'PomodoroRecordsComp' })

// @props
defineProps<{
    records: PomodoroRecordViewObject[]
}>()

// @emits
defineEmits<{
    viewAll: []
}>()
</script>

<template>
    <nue-div theme="pomodoro-records">
        <nue-div theme="header">
            <nue-icon name="time" />
            <nue-text theme="title">今日专注记录</nue-text>
            <nue-button theme="pure" @click="$emit('viewAll')">查看所有</nue-button>
        </nue-div>
        <nue-div v-if="records.length === 0" theme="empty">
            <nue-text theme="description">暂无专注记录</nue-text>
        </nue-div>
        <nue-div v-else theme="rows">
            <pomodoro-records-comp-row
                v-for="record in records"
                :key="record.id"
                :record="record"
            />
        </nue-div>
    </nue-div>
</template>

<style scoped>
.nue-div--pomodoro-records {
    flex-direction: column;
    gap: var(--nue-gap-sm);

    > .nue-div--header {
        display: flex;
        align-items: center;
        gap: var(--nue-gap-xs);

        > .nue-icon {
            font-size: var(--nue-text-xl);
        }

        > .nue-text--title {
            margin-right: auto;
        }
    }

    > .nue-div--empty {
        justify-content: center;
        align-items: center;
        padding: var(--nue-padding-df);
        color: var(--nue-primary-color-400);
    }

    > .nue-div--rows {
        flex-direction: column;
        gap: var(--nue-gap-2xs);
    }
}
</style>

