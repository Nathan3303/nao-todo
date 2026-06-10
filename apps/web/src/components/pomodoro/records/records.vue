<script setup lang="ts">
import { computed, ref } from 'vue'
import PomodoroRecordsCompRow from './row.vue'
import type { PomodoroRecordsCompProps, PomodoroRecordsCompEmits } from './types'

defineOptions({ name: 'PomodoroRecordsComp' })
const props = defineProps<PomodoroRecordsCompProps>()
const emit = defineEmits<PomodoroRecordsCompEmits>()

const dailyGoal = ref<number>(18000)

const totalDuration = computed(() => {
    return props.records.reduce((acc, cur) => acc + cur.duration, 0)
})

const totalDurationString = computed(() => {
    return durationToString(totalDuration.value)
})

const dailyGoalProgress = computed(() => {
    return (totalDuration.value / dailyGoal.value) * 100
})

const sessionCount = computed(() => {
    const sessions = new Set(props.records.map((record) => record.sessionId))
    return sessions.size
})

const durationToString = (duration: number) => {
    const hours = Math.floor(duration / 3600)
    const minutes = Math.floor((duration - hours * 3600) / 60)
    const seconds = Math.floor(duration - hours * 3600 - minutes * 60)
    const hoursStr = hours ? `${hours} 小时 ` : ''
    const minutesStr = minutes ? `${minutes} 分 ` : ''
    const secondsStr = seconds ? `${seconds} 秒 ` : ''
    return hoursStr + minutesStr + secondsStr
}
</script>

<template>
    <nue-div theme="pomodoro-records">
        <nue-div theme="header">
            <nue-div theme="title">
                <nue-icon name="focus3" />
                <nue-text theme="title">今日专注</nue-text>
            </nue-div>
        </nue-div>
        <nue-div theme="card">
            <nue-div theme="pomodoro-records-info">
                <nue-text theme="duration">专注时长 {{ totalDurationString }}</nue-text>
                <nue-text theme="count">
                    {{ props.records.length }} 条专注记录，{{ sessionCount }} 个专注会话
                </nue-text>
            </nue-div>
            <nue-div theme="daily-goal">
                <nue-div justify="space-between">
                    <nue-text theme="goal">今日专注目标 {{ durationToString(dailyGoal) }}</nue-text>
                    <nue-text theme="goal-count">
                        已完成 {{ dailyGoalProgress.toFixed(0) }} %
                    </nue-text>
                </nue-div>
                <nue-progress :percentage="dailyGoalProgress" hide-text />
            </nue-div>
        </nue-div>
        <nue-div theme="main">
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
    </nue-div>
</template>

<style scoped>
.nue-div--pomodoro-records {
    flex-direction: column;
    gap: var(--nue-gap-xs);

    > .nue-div--header {
        flex-direction: column;
        gap: var(--nue-gap-2xs);
        font-size: var(--nue-text-sm);

        > .nue-div--title {
            gap: var(--nue-gap-xs);
            align-items: center;

            > .nue-icon {
                font-size: var(--nue-text-df);
            }

            > .nue-text--title {
                margin-right: auto;
                font-size: var(--nue-text-df2);
            }
        }
    }

    > .nue-div--card {
        flex-direction: column;
        gap: var(--nue-gap-2xs);
        font-size: var(--nue-text-sm);
        color: var(--nue-primary-color-600);

        > .nue-div--pomodoro-records-info {
            gap: var(--nue-gap-2xs);
            align-items: center;
            justify-content: space-between;

            > .nue-text--duration {
                color: var(--nue-primary-color-900);
            }
        }

        > .nue-div--daily-goal {
            display: flex;
            gap: var(--nue-gap-2xs);
            flex-direction: column;
            margin-top: var(--nue-padding-xs);

            .nue-text--goal-count {
                color: var(--nue-primary-color-600);
            }
        }
    }

    > .nue-div--main {
        flex-direction: column;
        gap: var(--nue-gap-2xs);
        font-size: var(--nue-text-sm);

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
}
</style>

