<script setup lang="ts">
import PomodoroRecordsCompRow from './row.vue'

defineOptions({ name: 'PomodoroRecordsComp' })
</script>

<template>
    <nue-div theme="pomodoro-records">
        <nue-div theme="header">
            <nue-icon name="time" />
            <nue-text theme="title">今日专注记录</nue-text>
            <nue-button theme="small">查看所有</nue-button>
        </nue-div>
        <nue-div theme="rows">
            <pomodoro-records-comp-row v-for="item in 4" :key="item" />
        </nue-div>
    </nue-div>
</template>

<style scoped>
.nue-div--pomodoro-records {
    flex-direction: column;

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

    > .nue-div--rows {
        flex-direction: column;
        gap: var(--nue-gap-2xs);
    }
}
</style>

