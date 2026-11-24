<script setup lang="ts">
import { TaskCheckButton } from '@nao-todo/shared/components/task-check-button'
import { t } from '@nao-todo/shared/locales'
import { TaskDateSelector } from '../../date-selector'
import { computed, inject } from 'vue'
import type { UpdateTaskViewObject } from '@nao-todo/domain-task'
import { TASK_DETAILS_CONTEXT_KEY } from '../context'

const emit = defineEmits<{ (e: 'reload'): void }>()

const {
    vo,
    refreshKey,
    readOnly: readOnlyRef,
    closeDetails,
    beginEdit,
    updateTaskDetails
} = inject(TASK_DETAILS_CONTEXT_KEY)!

/** 只读态（`T795`）：上下文可缺省（缺失按「可编辑」，同 `isProjectArchived` 先例） */
const isReadOnly = computed(() => readOnlyRef?.value === true)
const switchState = () => {
    if (vo.value === null) return
    if (isReadOnly.value) return
    // DEF-153：点击（= 交互起点）即冻结 state 基准（此刻 vo.state 仍是旧值）
    beginEdit('state')
    updateTaskDetails(vo.value.id, { state: vo.value.isDone ? 'todo' : 'done' })
}

/**
 * 日期/提醒面板打开 ⇒ 冻结相关字段基准（`DEF-153`）
 * @description 只冻结**可能出现在本次载荷**里的字段；`updateTaskDetails` 仅对载荷涉及字段透传。
 */
const beginEditDates = () => {
    for (const field of [
        'startAt',
        'endAt',
        'remindAt',
        'remindRepeat',
        'remindTime',
        'remindWeekdays'
    ]) {
        beginEdit(field)
    }
}

const updateDateAndRemind = (updateVO: UpdateTaskViewObject) => {
    if (vo.value === null) return
    updateTaskDetails(vo.value.id, updateVO)
}
</script>

<template>
    <nue-header v-if="vo">
        <nue-div theme="left">
            <task-check-button
                :is-done="vo.isDone"
                :disabled="isReadOnly"
                :title="isReadOnly ? t('task.details.archivedReadOnly') : undefined"
                @change="switchState"
            />
            <task-date-selector
                :colored="!vo.isDone && !isReadOnly"
                :start-at="vo.startAt"
                :end-at="vo.endAt"
                :task="vo"
                :refresh-key="refreshKey"
                :disabled="isReadOnly"
                @edit-start="beginEditDates"
                @update-all="updateDateAndRemind"
            />
        </nue-div>
        <nue-div align="center" gap="0">
            <!-- <nue-button-group>
                <nue-button icon="refresh" theme="icon,small" />
            </nue-button-group> -->
            <nue-button icon="clear" theme="icon,small" @click="closeDetails">
                {{ t('task.details.close') }}
            </nue-button>
        </nue-div>
    </nue-header>
</template>

<style scoped>
.nue-header {
    padding: 1rem;
    width: 100%;
    height: auto;
    align-items: center;
    gap: 0;
    justify-content: space-between;
    flex-wrap: wrap;

    > .nue-div--left {
        align-items: center;
    }
}
</style>