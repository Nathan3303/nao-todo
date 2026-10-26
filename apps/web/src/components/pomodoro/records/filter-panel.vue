<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { PomodoroViewObject } from '@nao-todo/domain-pomodoro'
import type { PomodoroRecordsFilterState } from './types'

defineOptions({ name: 'PomodoroRecordsFilterPanel' })

const props = defineProps<{
    filters: PomodoroRecordsFilterState
    pomodoros: PomodoroViewObject[]
}>()

const emit = defineEmits<{
    (e: 'update:filters', filters: Partial<PomodoroRecordsFilterState>): void
    (e: 'apply'): void
    (e: 'reset'): void
}>()

const localFilters = reactive({ ...props.filters })

watch(
    () => props.filters,
    (newVal) => Object.assign(localFilters, newVal),
    { deep: true }
)

const handleApply = () => {
    emit('update:filters', { ...localFilters })
    emit('apply')
}
const handleReset = () => emit('reset')
</script>

<template>
    <nue-div theme="filter-panel">
        <nue-div theme="filter-row">
            <nue-div theme="filter-item">
                <nue-text theme="filter-label">开始日期</nue-text>
                <nue-date-picker v-model="localFilters.startTime" type="date" size="small" />
            </nue-div>
            <nue-div theme="filter-item">
                <nue-text theme="filter-label">结束日期</nue-text>
                <nue-date-picker v-model="localFilters.endTime" type="date" size="small" />
            </nue-div>
            <nue-div theme="filter-item">
                <nue-text theme="filter-label">类型</nue-text>
                <nue-select v-model="localFilters.type" placeholder="全部" clearable size="small">
                    <nue-select-option :value="void 0" label="全部" />
                    <nue-select-option :value="1" label="番茄专注" />
                    <nue-select-option :value="2" label="正计时" />
                </nue-select>
            </nue-div>
            <nue-div theme="filter-item">
                <nue-text theme="filter-label">任务名称</nue-text>
                <nue-input
                    v-model="localFilters.taskName"
                    placeholder="搜索任务名称"
                    clearable
                    size="small"
                />
            </nue-div>
            <nue-div theme="filter-item">
                <nue-text theme="filter-label">专注模板</nue-text>
                <nue-select
                    v-model="localFilters.pomodoroId"
                    placeholder="全部"
                    clearabl
                    size="small"
                >
                    <nue-select-option value="" label="全部" />
                    <template v-for="p in pomodoros" :key="p.id">
                        <nue-select-option :value="p.id" :label="p.name" />
                    </template>
                </nue-select>
            </nue-div>
            <nue-div theme="filter-actions">
                <nue-button theme="primary,small" @click="handleApply">筛选</nue-button>
                <nue-button theme="ghost,small" @click="handleReset">重置</nue-button>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<style scoped>
.nue-div--filter-panel {
    flex-direction: column;
    gap: var(--nue-gap-md);
}

.nue-div--filter-row {
    align-items: flex-end;
    flex-wrap: wrap;
    gap: var(--nue-gap-md);
}

.nue-div--filter-item {
    flex-direction: column;
    gap: var(--nue-gap-xs);
}

.nue-text--filter-label {
    font-size: var(--nue-text-sm);
    color: var(--nue-primary-color-600);
}

.nue-div--filter-actions {
    gap: var(--nue-gap-sm);
    margin-left: auto;
}

/* 窄屏：筛选保持展开，仅收紧间距并降为两列，避免把首屏记录区挤出屏（AC3） */
@media (max-width: 720px) {
    .nue-div--filter-panel {
        gap: var(--nue-gap-sm);
    }

    .nue-div--filter-row {
        gap: var(--nue-gap-sm);
    }

    .nue-div--filter-item {
        flex: 1 1 140px;
        min-width: 0;
    }

    .nue-div--filter-actions {
        flex: 1 1 100%;
        margin-left: 0;
        justify-content: flex-end;
    }
}
</style>