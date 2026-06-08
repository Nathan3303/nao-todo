<script setup lang="ts">
import PomodoroRecordsCompRow from './row.vue'
import type { PomodoroRecordViewObject } from '@nao-todo/types'

defineOptions({ name: 'PomodoroRecordsComp' })

// @props
defineProps<{
    records: PomodoroRecordViewObject[]
    loading: boolean
    disabledNextPage: boolean
}>()

// @emits
defineEmits<{
    viewAll: []
    nextPage: []
}>()
</script>

<template>
    <nue-div theme="pomodoro-records">
        <nue-div theme="header">
            <nue-icon name="time" />
            <nue-text theme="title">今日专注记录</nue-text>
            <nue-button theme="pure" @click="$emit('viewAll')">查看所有</nue-button>
        </nue-div>
        <nue-div v-if="records.length === 0 && !loading" theme="empty">
            <nue-text theme="description">暂无专注记录</nue-text>
        </nue-div>
        <nue-infinite-scroll
            v-else
            @load-more="$emit('nextPage')"
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

