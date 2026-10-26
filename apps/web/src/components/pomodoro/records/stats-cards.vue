<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'PomodoroRecordsStatsCards' })

type StatsProps = {
    totalDuration: string
    totalRecords: number
    sessionCount: number
    pomodoroPercentage: number
}

const props = defineProps<StatsProps>()

const formattedPercentage = computed(() => Math.round(props.pomodoroPercentage))
</script>

<template>
    <nue-div theme="stats-cards">
        <nue-div theme="card,stats-card">
            <nue-text theme="stats-label">总专注时长</nue-text>
            <nue-text theme="stats-value">{{ totalDuration }}</nue-text>
        </nue-div>
        <nue-div theme="card,stats-card">
            <nue-text theme="stats-label">总记录数</nue-text>
            <nue-text theme="stats-value">{{ totalRecords }}</nue-text>
        </nue-div>
        <nue-div theme="card,stats-card">
            <nue-text theme="stats-label">会话数</nue-text>
            <nue-text theme="stats-value">{{ sessionCount }}</nue-text>
        </nue-div>
        <nue-div theme="card,stats-card">
            <nue-text theme="stats-label">番茄占比</nue-text>
            <nue-text theme="stats-value">{{ formattedPercentage }}%</nue-text>
        </nue-div>
    </nue-div>
</template>

<style scoped>
.nue-div--stats-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--nue-gap-md);
    width: 100%;
}

.nue-div--stats-card {
    flex-direction: column;
    gap: var(--nue-gap-xs);
    padding: var(--nue-padding-md);
}

.nue-text--stats-label {
    font-size: var(--nue-text-sm);
    color: var(--nue-primary-color-600);
}

.nue-text--stats-value {
    font-size: var(--nue-text-xl);
    font-weight: 600;
    color: var(--nue-primary-color-900);
}

@media (max-width: 720px) {
    .nue-div--stats-cards {
        /* 窄屏 2×2：压缩首屏高度，保证首屏可见记录（AC3 / R4） */
        grid-template-columns: repeat(2, 1fr);
        gap: var(--nue-gap-sm);
    }

    .nue-div--stats-card {
        gap: var(--nue-gap-2xs);
        padding: var(--nue-padding-sm);
    }

    .nue-text--stats-value {
        font-size: var(--nue-text-lg);
    }
}

@media (max-width: 480px) {
    /* 极窄屏仍保持 2×2（PRD AC4：320px 下 2×2 可读且不占满首屏），只再收紧内距/字号 */
    .nue-div--stats-cards {
        grid-template-columns: repeat(2, 1fr);
        gap: var(--nue-gap-xs);
    }

    .nue-div--stats-card {
        padding: var(--nue-padding-xs);
    }

    .nue-text--stats-value {
        font-size: var(--nue-text-df);
    }
}
</style>