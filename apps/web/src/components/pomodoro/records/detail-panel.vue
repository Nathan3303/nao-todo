<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { formatDuration } from '@nao-todo/presentation/pomodoro/hooks/use-pomodoro-records-stats'
import type {
    PomodoroRecordViewObject,
    PomodoroViewObject
} from '@nao-todo/application/pomodoro/viewobjects'

defineOptions({ name: 'PomodoroRecordsDetailPanel' })

const props = defineProps<{
    visible: boolean
    record: PomodoroRecordViewObject | null
    pomodoros: PomodoroViewObject[]
}>()

const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'close'): void
}>()

const getPomodoroName = (pomodoroId: string | null) => {
    if (!pomodoroId) return '无'
    const pomodoro = props.pomodoros.find((p) => p.id === pomodoroId)
    return pomodoro?.name || '无'
}

const visible = computed({
    get: () => props.visible,
    set: (nv) => emit('update:visible', nv)
})

const typeLabel = computed(() => {
    if (!props.record) return '-'
    return props.record.type === 1 ? '番茄钟' : '正计时'
})

const formattedStartAt = computed(() => {
    if (!props.record) return '-'
    return dayjs(props.record.startAt).format('YYYY-MM-DD HH:mm:ss')
})

const formattedEndAt = computed(() => {
    if (!props.record) return '-'
    return dayjs(props.record.endAt).format('YYYY-MM-DD HH:mm:ss')
})

const formattedDuration = computed(() => {
    if (!props.record) return '-'
    return formatDuration(props.record.duration)
})

const handleClose = () => {
    emit('update:visible', false)
    emit('close')
}
</script>

<template>
    <nue-drawer v-model="visible" theme="right" title="专注详情" @after-close="handleClose">
        <div v-if="record" class="pomodoro-records-detail__body">
            <div class="pomodoro-records-detail__section">
                <div class="pomodoro-records-detail__field">
                    <nue-text theme="field-label">专注类型</nue-text>
                    <nue-text theme="field-value">{{ typeLabel }}</nue-text>
                </div>
                <div class="pomodoro-records-detail__field">
                    <nue-text theme="field-label">任务名称</nue-text>
                    <nue-text theme="field-value">{{ record.taskName || '无关联任务' }}</nue-text>
                </div>
                <div class="pomodoro-records-detail__field">
                    <nue-text theme="field-label">专注模板</nue-text>
                    <nue-text theme="field-value">{{
                        getPomodoroName(record.pomodoroId)
                    }}</nue-text>
                </div>
            </div>
            <div class="pomodoro-records-detail__section">
                <div class="pomodoro-records-detail__field">
                    <nue-text theme="field-label">开始时间</nue-text>
                    <nue-text theme="field-value">{{ formattedStartAt }}</nue-text>
                </div>
                <div class="pomodoro-records-detail__field">
                    <nue-text theme="field-label">结束时间</nue-text>
                    <nue-text theme="field-value">{{ formattedEndAt }}</nue-text>
                </div>
                <div class="pomodoro-records-detail__field">
                    <nue-text theme="field-label">专注时长</nue-text>
                    <nue-text theme="field-value">{{ formattedDuration }}</nue-text>
                </div>
            </div>
            <div class="pomodoro-records-detail__section">
                <div class="pomodoro-records-detail__field">
                    <nue-text theme="field-label">会话 ID</nue-text>
                    <nue-text theme="field-value monospace">{{ record.sessionId }}</nue-text>
                </div>
            </div>
            <div v-if="record.note" class="pomodoro-records-detail__section">
                <div class="pomodoro-records-detail__note">
                    <nue-text>{{ record.note }}</nue-text>
                </div>
            </div>
        </div>
        <nue-empty v-else description="暂无专注记录详情" />
    </nue-drawer>
</template>

<style scoped>
.pomodoro-records-detail {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.pomodoro-records-detail__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--nue-padding-md);
}

.pomodoro-records-detail__body {
    display: flex;
    flex-direction: column;
    flex: auto;
    gap: var(--nue-gap-md);
    padding: var(--nue-padding-md);
    overflow-y: auto;
}

.pomodoro-records-detail__section {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-sm);
}

.pomodoro-records-detail__field {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--nue-gap-md);
}

.pomodoro-records-detail__note {
    padding: var(--nue-padding-sm);
    background-color: var(--nue-primary-color-50);
    border-radius: var(--nue-radius-sm);
    line-height: 1.6;
}

.nue-text--title {
    font-size: var(--nue-text-xl);
    font-weight: 600;
}

.nue-text--section-title {
    font-size: var(--nue-text-sm);
    font-weight: 500;
    color: var(--nue-primary-color-700);
}

.nue-text--field-label {
    font-size: var(--nue-text-sm);
    color: var(--nue-primary-color-600);
    flex: none;
}

.nue-text--field-value {
    font-size: var(--nue-text-sm);
    color: var(--nue-primary-color-900);
    text-align: right;
    flex: auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &.monospace {
        font-family: ui-monospace, 'Cascadia Mono', monospace;
        font-size: var(--nue-text-xs);
    }
}
</style>

