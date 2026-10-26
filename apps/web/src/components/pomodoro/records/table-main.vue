<script setup lang="ts">
import type { PomodoroRecordViewObject, PomodoroViewObject } from '@nao-todo/domain-pomodoro'
import { formatDuration } from '@nao-todo/presentation/pomodoro'
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

/** 窄屏卡片可访问名（AC9）：类型 + 任务名 + 开始时间 */
const cardLabel = (record: PomodoroRecordViewObject) =>
    `${getTypeLabel(record.type)} ${record.taskName || '-'} ${formatTime(record.startAt)}`
</script>

<template>
    <nue-div class="pomodoro-records-table">
        <!-- 桌面（>720px）表格：保持既有结构不动 -->
        <nue-scroll-bar vertical horizontal>
            <div class="pomodoro-records-table__header">
                <div class="pomodoro-records-table__cell pomodoro-records-table__cell--type">
                    类型
                </div>
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
                    <div
                        class="pomodoro-records-table__cell pomodoro-records-table__cell--duration"
                    >
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
        </nue-scroll-bar>

        <!-- 窄屏（≤720px）卡片列表：与表格同一 records 数据源（R1） -->
        <nue-div class="pomodoro-record-card-list">
            <div
                v-for="record in records"
                :key="record.id"
                class="pomodoro-record-card"
                role="button"
                tabindex="0"
                :aria-label="cardLabel(record)"
                @click="emit('showDetail', record.id)"
                @keydown.enter.prevent="emit('showDetail', record.id)"
            >
                <div class="pomodoro-record-card__head">
                    <div class="pomodoro-record-card__type">
                        <nue-icon :name="getTypeIcon(record.type)" />
                        <span>{{ getTypeLabel(record.type) }}</span>
                    </div>
                    <div class="pomodoro-record-card__time" :title="formatDate(record.startAt)">
                        {{ formatTime(record.startAt) }}
                    </div>
                </div>
                <div class="pomodoro-record-card__task" :title="record.taskName || '-'">
                    {{ record.taskName || '-' }}
                </div>
                <div class="pomodoro-record-card__duration">
                    {{ formatDuration(record.duration) }}
                </div>
            </div>
        </nue-div>
    </nue-div>
</template>

<style scoped>
.pomodoro-records-table {
    display: flex;
    flex-direction: column;
    width: 100%;
    /* 在 __table(flex 容器)中以 flex 撑满，替代 height:100% */
    flex: 1;
    min-height: 0;

    /* NueScrollBar 撑满表格板块，滚动容器高度受控 */
    :deep(.nue-scroll-bar) {
        height: 100%;
        min-height: 0;
        flex: auto;
    }

    :deep(.nue-scroll-bar__viewport) {
        height: 100%;
    }
}

.pomodoro-records-table__header {
    display: flex;
    gap: var(--nue-gap-sm);
    padding: var(--nue-padding-sm) 0;
    border-bottom: 1px solid var(--nue-primary-color-200);
    font-size: var(--nue-text-sm);
    font-weight: 500;
    color: var(--nue-primary-color-600);
    /* 表头固定在滚动容器顶部，行滚动时保持可见 */
    position: sticky;
    top: 0;
    z-index: 1;
    background-color: var(--nue-primary-color-0);
}

.pomodoro-records-table__body {
    display: flex;
    flex-direction: column;
    /* 列宽固定，窄容器时触发横向滚动 */
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

/* 窄屏卡片列表：默认只在 ≤720px 出现，桌面由下方媒体块隐藏 */
.pomodoro-record-card-list {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-sm);
    width: 100%;
}

.pomodoro-record-card {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-xs);
    width: 100%;
    min-height: 40px;
    box-sizing: border-box;
    padding: var(--nue-padding-sm) var(--nue-padding-md);
    background-color: var(--nue-primary-color-0);
    border: 1px solid var(--nue-divider-color);
    border-radius: var(--nue-radius-sm);
    cursor: pointer;
    transition:
        background-color 0.15s ease,
        border-color 0.15s ease;

    &:hover {
        background-color: var(--nue-primary-color-100);
    }

    &:focus-visible {
        outline: 2px solid var(--nue-primary-color-500);
        outline-offset: 2px;
    }
}

.pomodoro-record-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nue-gap-sm);
    min-width: 0;
}

.pomodoro-record-card__type {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-xs);
    font-size: var(--nue-text-sm);
    color: var(--nue-primary-color-600);
}

.pomodoro-record-card__time {
    flex: none;
    font-size: var(--nue-text-sm);
    color: var(--nue-primary-color-600);
    font-variant-numeric: tabular-nums;
}

/* 长任务名末尾省略，不撑宽卡片（AC4） */
.pomodoro-record-card__task {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--nue-text-df);
    color: var(--nue-primary-color-900);
}

.pomodoro-record-card__duration {
    font-size: var(--nue-text-sm);
    font-weight: 500;
    color: var(--nue-primary-color-700);
}

/* 760px 硬宽只保留在桌面分支（窄屏卡片化，禁止横向溢出） */
@media (min-width: 721px) {
    .pomodoro-records-table__header {
        min-width: 760px;
    }

    .pomodoro-records-table__body {
        min-width: 760px;
    }

    /* 桌面保持表格为唯一列表形态 */
    .pomodoro-record-card-list {
        display: none;
    }
}

@media (max-width: 720px) {
    /* 窄屏：表格让位给卡片列表 */
    .pomodoro-records-table {
        flex: none;
        min-height: auto;
    }

    .pomodoro-records-table :deep(.nue-scroll-bar) {
        display: none;
    }
}
</style>