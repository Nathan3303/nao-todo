<script setup lang="ts">
import type {
    PomodoroRecordViewObject,
    PomodoroViewObject
} from '@nao-todo/application/pomodoro/viewobjects'
import { formatDuration } from '@nao-todo/presentation/pomodoro/hooks/use-pomodoro-records-stats'
import dayjs from 'dayjs'

defineOptions({ name: 'PomodoroRecordsTableMain' })

const props = defineProps<{
    records: PomodoroRecordViewObject[]
    pomodoros: PomodoroViewObject[]
}>()

const emit = defineEmits<{
    (e: 'showDetail', recordId: string): void
}>()

const getPomodoroName = (pomodoroId: string | null) => {
    if (!pomodoroId) return '-'
    const pomodoro = props.pomodoros.find((p) => p.id === pomodoroId)
    return pomodoro?.name || '-'
}

const getTypeLabel = (type: number) => (type === 1 ? '番茄钟' : '正计时')
const getTypeIcon = (type: number) => (type === 1 ? 'ntd-fanqie' : 'focus')
const formatTime = (time: string) => dayjs(time).format('HH:mm')
const formatDate = (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm')
</script>

<template>
    <nue-div class="pomodoro-records-table">
        <div class="pomodoro-records-table__header">
            <div class="pomodoro-records-table__cell pomodoro-records-table__cell--type">类型</div>
            <div class="pomodoro-records-table__cell pomodoro-records-table__cell--task">
                任务名称
            </div>
            <div class="pomodoro-records-table__cell pomodoro-records-table__cell--template">
                专注模板
            </div>
            <div class="pomodoro-records-table__cell pomodoro-records-table__cell--duration">
                时长
            </div>
            <div class="pomodoro-records-table__cell pomodoro-records-table__cell--time">
                开始时间
            </div>
            <div class="pomodoro-records-table__cell pomodoro-records-table__cell--time">
                结束时间
            </div>
            <div class="pomodoro-records-table__cell pomodoro-records-table__cell--actions">
                操作
            </div>
        </div>
        <div class="pomodoro-records-table__body">
            <div v-for="record in records" :key="record.id" class="pomodoro-records-table__row">
                <div class="pomodoro-records-table__cell pomodoro-records-table__cell--type">
                    <nue-icon :name="getTypeIcon(record.type)" />
                    <span class="pomodoro-records-table__type-label">
                        {{ getTypeLabel(record.type) }}
                    </span>
                </div>
                <div
                    class="pomodoro-records-table__cell pomodoro-records-table__cell--task"
                    :title="record.taskName"
                >
                    {{ record.taskName || '无关联任务' }}
                </div>
                <div
                    class="pomodoro-records-table__cell pomodoro-records-table__cell--template"
                    :title="getPomodoroName(record.pomodoroId)"
                >
                    {{ getPomodoroName(record.pomodoroId) }}
                </div>
                <div class="pomodoro-records-table__cell pomodoro-records-table__cell--duration">
                    {{ formatDuration(record.duration) }}
                </div>
                <div
                    class="pomodoro-records-table__cell pomodoro-records-table__cell--time"
                    :title="formatDate(record.startAt)"
                >
                    {{ formatTime(record.startAt) }}
                </div>
                <div
                    class="pomodoro-records-table__cell pomodoro-records-table__cell--time"
                    :title="formatDate(record.endAt)"
                >
                    {{ formatTime(record.endAt) }}
                </div>
                <div class="pomodoro-records-table__cell pomodoro-records-table__cell--actions">
                    <nue-icon name="eye" @click.stop="emit('showDetail', record.id)" />
                </div>
            </div>
        </div>
    </nue-div>
</template>

<style scoped>
.pomodoro-records-table {
    display: flex;
    flex-direction: column;
    width: 100%;
}

.pomodoro-records-table__header {
    display: flex;
    gap: var(--nue-gap-sm);
    padding: var(--nue-padding-sm) 0;
    border-bottom: 1px solid var(--nue-primary-color-200);
    font-size: var(--nue-text-sm);
    font-weight: 500;
    color: var(--nue-primary-color-600);
}

.pomodoro-records-table__body {
    display: flex;
    flex-direction: column;
}

.pomodoro-records-table__row {
    display: flex;
    gap: var(--nue-gap-sm);
    padding: var(--nue-padding-sm) 0;
    border-bottom: 1px solid var(--nue-primary-color-100);
    align-items: center;
    font-size: var(--nue-text-sm);
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover {
        background-color: var(--nue-primary-color-50);
    }
}

.pomodoro-records-table__cell {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--nue-primary-color-900);
}

.pomodoro-records-table__cell--type {
    width: 100px;
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--nue-gap-xs);
}

.pomodoro-records-table__type-label {
    font-size: var(--nue-text-sm);
}

.pomodoro-records-table__cell--task {
    flex: 1;
    min-width: 120px;
}

.pomodoro-records-table__cell--template {
    width: 140px;
    flex: none;
    color: var(--nue-primary-color-600);
}

.pomodoro-records-table__cell--duration {
    width: 100px;
    flex: none;
    font-weight: 500;
}

.pomodoro-records-table__cell--time {
    width: 80px;
    flex: none;
    color: var(--nue-primary-color-600);
}

.pomodoro-records-table__cell--actions {
    width: 60px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;

    .nue-icon {
        cursor: pointer;
        color: var(--nue-primary-color-600);
        font-size: var(--nue-text-df);
        transition: color 0.15s ease;

        &:hover {
            color: var(--nue-primary-color-900);
        }
    }
}
</style>

