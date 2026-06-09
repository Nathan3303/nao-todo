<script setup lang="ts">
import { computed } from 'vue'
import PomodoroRecordsCompRow from './row.vue'
import type { PomodoroRecordsCompProps, PomodoroRecordsCompEmits } from './types'

defineOptions({ name: 'PomodoroRecordsComp' })
const props = defineProps<PomodoroRecordsCompProps>()
const emit = defineEmits<PomodoroRecordsCompEmits>()

const timerMinutes = computed(() => {
    return props.records.reduce((acc, cur) => acc + cur.duration, 0) / 60
})
</script>

<template>
    <nue-div theme="pomodoro-records">
        <nue-div theme="header">
            <nue-icon name="time" />
            <nue-text theme="title">
                今日专注 {{ props.records.length }} 次，时长总计 {{ timerMinutes.toFixed(2) }} 分钟
            </nue-text>
        </nue-div>
        <nue-div v-if="props.records.length === 0 && !props.loading" theme="empty">
            <nue-text>暂无专注记录</nue-text>
        </nue-div>
        <nue-infinite-scroll
            v-else
            @load-more="emit('nextPage')"
            :loading="loading"
            :disabled="disabledNextPage"
            trigger-height="2px"
        >
            <nue-div theme="rows">
                <pomodoro-records-comp-row
                    v-for="record in records"
                    :key="record.id"
                    :record="record"
                />
            </nue-div>
            <template #loading>
                <nue-div theme="loading-bar">
                    <nue-text size="var(--nue-text-xs)">加载中...</nue-text>
                </nue-div>
            </template>
            <template #disabled>
                <nue-div v-if="records.length > 0" theme="done-bar">
                    <nue-text size="var(--nue-text-xs)">已加载全部记录</nue-text>
                </nue-div>
            </template>
        </nue-infinite-scroll>
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
            font-size: var(--nue-text-df);
        }

        > .nue-text--title {
            margin-right: auto;
            font-size: var(--nue-text-df2);
        }
    }

    > .nue-div--empty {
        justify-content: center;
        align-items: center;
        padding: var(--nue-padding-df);
        color: var(--nue-primary-color-400);
        font-size: var(--nue-text-xs);
    }

    > .nue-infinite-scroll-wrapper {
        overflow-y: auto;
        max-height: 100%;

        .nue-div--rows {
            flex-direction: column;
            gap: var(--nue-gap-2xs);
        }
    }

    > .nue-infinite-scroll-wrapper .nue-div--loading-bar,
    > .nue-infinite-scroll-wrapper .nue-div--done-bar {
        justify-content: center;
        align-items: center;
        padding: var(--nue-padding-xs);
        color: var(--nue-primary-color-400);
    }
}
</style>

