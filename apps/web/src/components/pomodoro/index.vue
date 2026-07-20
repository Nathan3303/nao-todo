<script setup lang="ts">
import { computed, inject } from 'vue'
import { storeToRefs } from 'pinia'
import {
    PomodoroTimer,
    PomodoroFocus,
    PomodoroRecordList,
    PomodoroNoteInputer
} from '@nao-todo/presentation/pomodoro'
import { usePomodoroPage } from './use-pomodoro-page'
import { PomodoroFocusDependDropdown } from './focus-depend-dropdown'
import { PomodoroHeader } from './header'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'

defineOptions({ name: 'PomodoroPage' })

const { dialogManager, subscriber } = inject(POMODORO_VIEW_CONTEXT_KEY)!

const {
    activeTab,
    timerStore,
    focusStore,
    taskName,
    handleSelectTask,
    handleClearTask,
    presetName,
    handleSelectPreset,
    todayRecords,
    noteText,
    setNoteText,
    recordLoading,
    recordIsDone,
    handleNextPage,
    handleStart,
    handleAdjustTime,
    handleReset,
    handleOpenSettings,
    handleMainAction,
    handleCancel,
    handleEnd
} = usePomodoroPage(dialogManager, subscriber)

const { phase, remainingSeconds, totalSeconds, isRunning } = storeToRefs(timerStore)
const { status, elapsedSeconds } = storeToRefs(focusStore)

// 专注依赖触发文案：常用专注名与任务名同时存在时用短横线连接
const dependLabel = computed(() => {
    const names = [presetName.value, taskName.value].filter(Boolean)
    return '< ' + (names.length > 0 ? `${names.join(' / ')}` : '专注') + ' >'
})
</script>

<template>
    <!-- 番茄钟页面布局 -->
    <nue-container id="Pomodoro">
        <!-- 页面标题 -->
        <pomodoro-header />
        <nue-main>
            <nue-content>
                <nue-div vertical align="center" justify="center" style="grid-area: timer" gap="0">
                    <pomodoro-focus-depend-dropdown
                        :type="activeTab === 'timer' ? 1 : 2"
                        :preset-name="presetName"
                        :task-name="taskName"
                        @select-preset="handleSelectPreset"
                        @select-task="handleSelectTask"
                        @clear-task="handleClearTask"
                    >
                        <template #default="{ open }">
                            <nue-text theme="task-select-trigger" @click="open" title="专注">
                                {{ dependLabel }}
                            </nue-text>
                        </template>
                    </pomodoro-focus-depend-dropdown>
                    <!-- 番茄专注计时器 -->
                    <pomodoro-timer
                        v-if="activeTab === 'timer'"
                        :phase="phase"
                        :is-running="isRunning"
                        :remaining-seconds="remainingSeconds"
                        :total-seconds="totalSeconds"
                        :task-name="taskName"
                        @start="handleStart"
                        @pause="timerStore.pause()"
                        @resume="timerStore.resume()"
                        @reset="handleReset"
                        @skip="timerStore.skip()"
                        @adjust-time="handleAdjustTime($event)"
                        @open-settings="handleOpenSettings"
                    >
                    </pomodoro-timer>
                    <!-- 正计时计时器 -->
                    <pomodoro-focus
                        v-if="activeTab === 'focus'"
                        style="grid-area: timer"
                        :status="status"
                        :elapsed-seconds="elapsedSeconds"
                        :task-name="taskName"
                        @cancel="handleCancel"
                        @start="handleMainAction"
                        @pause="handleMainAction"
                        @resume="handleMainAction"
                        @end="handleEnd"
                    >
                    </pomodoro-focus>
                </nue-div>
                <!-- 专注记录 -->
                <pomodoro-record-list
                    style="grid-area: today"
                    :records="todayRecords"
                    :loading="recordLoading"
                    :disabled-next-page="recordIsDone"
                    @next-page="handleNextPage"
                />
                <!-- 专注笔记 -->
                <pomodoro-note-inputer
                    style="grid-area: note"
                    :note-text="noteText"
                    @update:note-text="setNoteText($event)"
                />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
#Pomodoro {
    /* gap: var(--nue-gap-lg); */

    > .nue-main .nue-content {
        display: grid;
        grid-template-columns: 4fr 3fr;
        grid-template-rows: 4fr 3fr;
        grid-template-areas: 'timer today' 'note today';
        width: 100%;
        height: 100%;
        flex: none;
        gap: var(--nue-gap-df);
        overflow: visible;
        padding: var(--nue-padding-df);
        box-sizing: border-box;

        @media (max-width: 720px) {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr 1fr 1fr;
            grid-template-areas: 'timer' 'note' 'today';
            gap: var(--nue-gap-lg);
        }
    }
}
</style>
