<script setup lang="ts">
import { computed, inject } from 'vue'
import type { TaskDetailsViewObject } from '../types'
import { NueConfirm } from 'nue-ui'
import { TASK_DETAILS_CONTEXT_KEY } from '../context'

defineOptions({ name: 'DetailsMainPomodoroInfo' })
const props = defineProps<{ taskDetails: TaskDetailsViewObject }>()

// @context
const {
    pomodoroCurrentTaskId: currentTaskId,
    pomodoroTimerStatus: timerStatus,
    pomodoroFocusStatus: focusStatus,
    selectTaskAndStartTimer,
    selectTaskAndStartFocus,
    resetTimer,
    resetFocus
} = inject(TASK_DETAILS_CONTEXT_KEY)!

// 是否正在专注
const isTimerRunning = computed(() => {
    return currentTaskId.value === props.taskDetails.id && timerStatus.value === 'running'
})

// 是否正在专注正计时
const isFocusRunning = computed(() => {
    return currentTaskId.value === props.taskDetails.id && focusStatus.value !== 'idle'
})

// 是否正在专注
const isRunning = computed(() => {
    return isTimerRunning.value || isFocusRunning.value
})

// 专注状态标题
const runningInfoTitle = computed(() => {
    if (isTimerRunning.value) return '正在番茄专注'
    if (isFocusRunning.value) return '正在正计时专注'
    return '专注'
})

/**
 * 执行下拉操作
 * @param executeId 执行 ID
 */
const executeHandler = (executeId: string) => {
    switch (executeId) {
        case 'SwitchTimerStatus':
            if (isTimerRunning.value) {
                NueConfirm({
                    title: '确认结束番茄专注吗？',
                    content: '若当前处于正在专注状态并结束，将不会记录该番茄',
                    confirmButtonText: '确认结束',
                    cancelButtonText: '取消',
                    onConfirm: () => resetTimer()
                })
                return
            }
            selectTaskAndStartTimer(props.taskDetails.id, props.taskDetails.name)
            break
        case 'SwitchFocusStatus':
            if (isFocusRunning.value) {
                NueConfirm({
                    title: '确认结束正计时专注吗？',
                    content: '若当前处于正在专注状态并结束，将不会记录该正计时专注',
                    confirmButtonText: '确认结束',
                    cancelButtonText: '取消',
                    onConfirm: () => resetFocus()
                })
                return
            }
            selectTaskAndStartFocus(props.taskDetails.id, props.taskDetails.name)
            break
        default:
            break
    }
}
</script>

<template>
    <nue-dropdown placement="bottom-center" @execute="executeHandler">
        <template #trigger="{ trigger }">
            <nue-button
                icon="focus3"
                :theme="{ small: true, secondary: isRunning }"
                @click="trigger"
            >
                {{ runningInfoTitle }}
            </nue-button>
        </template>
        <nue-dropdown-item
            :disabled="isFocusRunning"
            execute-id="SwitchTimerStatus"
            size="small"
            icon="ntd-fanqie"
        >
            {{ isTimerRunning ? '结束番茄专注' : '开始番茄专注' }}
        </nue-dropdown-item>
        <nue-dropdown-item
            :disabled="isTimerRunning"
            execute-id="SwitchFocusStatus"
            size="small"
            icon="ntd-zzt"
        >
            {{ isFocusRunning ? '结束正计时专注' : '开始正计时专注' }}
        </nue-dropdown-item>
    </nue-dropdown>
</template>

<style>
.nue-tooltip--pomodoro-info {
    font-size: var(--nue-text-sm);
    color: var(--nue-primary-color-0);
}
</style>
