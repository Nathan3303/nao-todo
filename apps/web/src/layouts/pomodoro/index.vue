<script setup lang="ts">
import { inject } from 'vue'
import { storeToRefs } from 'pinia'
import {
    PomodoroTimerComp,
    PomodoroFocusComp,
    PomodoroRecordsComp,
    PomodoroNotesComp
} from '@/components/pomodoro'
import { usePomodoroPage } from './use-pomodoro-page'
import { PomodoroTaskSelectDropdown } from './task-select-dropdown'
import { PomodoroHeader } from './header'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'

defineOptions({ name: 'PomodoroPage' })

const { dialogManager, subscriber } = inject(POMODORO_VIEW_CONTEXT_KEY)!

const {
    activeTab,
    timerStore,
    focusStore,
    taskId,
    taskName,
    handleSelectTask,
    todayRecords,
    noteText,
    setNoteText,
    recordLoading,
    recordIsDone,
    handleNextPage,
    showTaskDetails,
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
</script>

<template>
    <!-- 番茄钟页面布局 -->
    <nue-container id="Pomodoro">
        <!-- 页面标题 -->
        <pomodoro-header />
        <nue-main>
            <nue-content>
                <!-- 番茄专注计时器 -->
                <pomodoro-timer-comp
                    v-if="activeTab === 'timer'"
                    style="grid-area: timer"
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
                    <template #BelowTimeString>
                        <nue-div vertical gap="0" align="center" flex="1">
                            <pomodoro-task-select-dropdown @select-task="handleSelectTask">
                                <template #default="{ open }">
                                    <nue-text
                                        theme="task-select-trigger"
                                        @click="open"
                                        title="关联任务"
                                    >
                                        {{ taskName || '未选择关联任务' }}
                                    </nue-text>
                                </template>
                            </pomodoro-task-select-dropdown>
                            <nue-button
                                v-if="taskId"
                                theme="pure"
                                icon="eye"
                                @click="showTaskDetails(taskId)"
                            />
                        </nue-div>
                    </template>
                </pomodoro-timer-comp>
                <!-- 正计时计时器 -->
                <pomodoro-focus-comp
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
                    <template #BelowTimeString>
                        <nue-div vertical gap="0" align="center" flex="1">
                            <pomodoro-task-select-dropdown @select-task="handleSelectTask">
                                <template #default="{ open }">
                                    <nue-text
                                        theme="task-select-trigger"
                                        @click="open"
                                        title="关联任务"
                                    >
                                        {{ taskName || '未选择关联任务' }}
                                    </nue-text>
                                </template>
                            </pomodoro-task-select-dropdown>
                            <nue-button
                                v-if="taskId"
                                theme="pure"
                                icon="eye"
                                @click="showTaskDetails(taskId)"
                            />
                        </nue-div>
                    </template>
                </pomodoro-focus-comp>
                <!-- 专注记录 -->
                <pomodoro-records-comp
                    style="grid-area: today"
                    :records="todayRecords"
                    :loading="recordLoading"
                    :disabled-next-page="recordIsDone"
                    @next-page="handleNextPage"
                />
                <!-- 专注笔记 -->
                <pomodoro-notes-comp
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

