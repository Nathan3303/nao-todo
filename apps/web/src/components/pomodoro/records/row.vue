<script setup lang="ts">
defineOptions({ name: 'PomodoroRecordsCompRow' })
</script>

<template>
    <nue-div theme="card,pomodoro-records-row">
        <nue-text theme="title" :clamped="1">专注所关联任务的名称</nue-text>
        <nue-text theme="duration">今天 , 09:30 - 10:00 , 25m</nue-text>
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
        /* margin: 0 var(--nue-padding-xs); */
        flex: none;
    }
}
</style>

