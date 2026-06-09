<script setup lang="ts">
import { inject } from 'vue'
import { storeToRefs } from 'pinia'
import {
    PomodoroTimerComp,
    PomodoroFocusComp,
    PomodoroRecordsComp,
    PomodoroNotesComp
} from '@/components/pomodoro'
import type { PomodoroViewContext } from '@/views/index/pomodoro/pomodoro-view'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { usePomodoroPage } from './use-pomodoro-page'
import { PomodoroTaskSelectDropdown } from './task-select-dropdown'

defineOptions({ name: 'PomodoroPage' })

const { dialogManager, subscriber } = inject<PomodoroViewContext>(POMODORO_VIEW_CONTEXT_KEY)!

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
        <nue-header>
            <nue-div theme="title-and-description">
                <nue-div theme="title-wrapper">
                    <nue-div theme="title">番茄专注</nue-div>
                    <nue-div theme="tabs">
                        <nue-link icon="ntd-fanqie" route="/pomodoro/timer">番茄专注</nue-link>
                        <nue-link icon="ntd-zzt" route="/pomodoro/focus">正计时</nue-link>
                    </nue-div>
                    <nue-div theme="actions">
                        <!-- <nue-button icon="plus" theme="icon,ghost" /> -->
                        <nue-tooltip content="专注记录" size="small">
                            <nue-button icon="ntd-history" theme="icon,ghost" disabled />
                        </nue-tooltip>
                    </nue-div>
                </nue-div>
                <nue-text v-if="activeTab === 'timer'" theme="description">
                    番茄时钟是一种时间管理工具，它将工作时间和休息时间交替进行。
                </nue-text>
                <nue-text v-else theme="description">
                    正计时是一种自由计时模式，开始后正向计时，可随时暂停，点击「结束」后自动保存专注记录。
                </nue-text>
            </nue-div>
        </nue-header>
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
                        <nue-div vertical gap="0" align="center">
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
                        <nue-div vertical gap="0" align="center">
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
    padding: var(--nue-padding-df);
    gap: var(--nue-gap-lg);

    > .nue-header {
        padding: 0;
        height: auto;
        justify-content: space-between;
        border: none;

        > .nue-div--title-and-description {
            width: 100%;
            flex-direction: column;
            gap: var(--nue-gap-2xs);

            > .nue-div--title-wrapper {
                flex: auto;
                justify-content: space-between;
                position: relative;

                > .nue-div--title {
                    align-items: center;
                    font-size: var(--nue-text-xl);
                    gap: var(--nue-gap-2xs);
                }

                > .nue-div--tabs {
                    width: fit-content;
                    padding: var(--nue-padding-2xs);
                    background-color: var(--nue-primary-color-200);
                    border-radius: var(--nue-primary-radius);
                    gap: var(--nue-gap-2xs);
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);

                    .nue-link {
                        --nue-link-background-color: transparent;
                        --nue-link-color: var(--nue-primary-color-600);
                        --nue-link-actived-background-color: var(--nue-primary-color-900);
                        --nue-link-actived-color: var(--nue-primary-color-100);
                        --nue-link-actived-text-decoration: none;

                        font-size: var(--nue-text-sm);
                        width: fit-content;
                        height: var(--nue-box-size-xs);
                        justify-content: center;
                        align-items: center;
                        padding: 0 var(--nue-padding-xs);
                        border-radius: var(--nue-primary-radius);
                    }
                }

                > .nue-div--actions {
                    width: fit-content;
                }
            }

            > .nue-text--description {
                font-size: var(--nue-text-sm);
                color: var(--nue-primary-color-600);
            }
        }
    }

    > .nue-main .nue-content {
        display: grid;
        grid-template-columns: minmax(24rem, 2fr) 4fr;
        grid-template-rows: minmax(24rem, 2fr) 4fr;
        grid-template-areas: 'timer today' 'note note';
        width: 100%;
        height: 100%;
        flex: none;
        gap: var(--nue-gap-df);
        overflow: visible;

        @media (max-width: 720px) {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr 1fr 1fr;
            grid-template-areas: 'timer' 'note' 'today';
            gap: var(--nue-gap-lg);
        }
    }
}
</style>

