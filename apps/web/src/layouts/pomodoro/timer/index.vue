<script setup lang="ts">
import { inject } from 'vue'
import { storeToRefs } from 'pinia'
import { PomodoroTimerComp, PomodoroRecordsComp, PomodoroNotesComp } from '@/components/pomodoro'
import type { PomodoroViewContext } from '@/views/index/pomodoro/pomodoro-view'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { usePomodoroTimerStore } from '@/stores/pomodoro-timer-store'
import { useTimerPage } from './use-timer-page'
import { PomodoroTaskSelectDropdown } from '../task-select-dropdown'

defineOptions({ name: 'PomodoroTimer' })

const { isDisplayAside, switchDisplayAside, dialogManager, subscriber } =
    inject<PomodoroViewContext>(POMODORO_VIEW_CONTEXT_KEY)!

const timerStore = usePomodoroTimerStore()
const { phase, remainingSeconds, totalSeconds, isRunning } = storeToRefs(timerStore)

const {
    taskId,
    taskName,
    handleSelectTask,
    todayRecords,
    noteText,
    setNoteText,
    handleStart,
    handleAdjustTime,
    handleReset,
    handleOpenSettings,
    recordLoading,
    recordIsDone,
    handleNextPage,
    showTaskDetails
} = useTimerPage(dialogManager, subscriber)
</script>

<template>
    <nue-container id="PomodoroFocus">
        <nue-header>
            <nue-div theme="title-and-description">
                <nue-div theme="title-wrapper">
                    <nue-div theme="title">
                        <nue-button
                            :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                            theme="icon,ghost"
                            @click="switchDisplayAside"
                        />
                        <nue-text>番茄专注</nue-text>
                    </nue-div>
                    <nue-div theme="actions">
                        <nue-button icon="plus" theme="icon,ghost" />
                        <nue-tooltip content="计时器设置" size="small">
                            <nue-button
                                icon="setting"
                                theme="icon,ghost"
                                @click="handleOpenSettings"
                            />
                        </nue-tooltip>
                    </nue-div>
                </nue-div>
                <nue-text theme="description">
                    番茄时钟是一种时间管理工具，它将工作时间和休息时间交替进行。
                </nue-text>
            </nue-div>
            <nue-div theme="actions"></nue-div>
        </nue-header>
        <nue-main>
            <nue-content>
                <pomodoro-timer-comp
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
                <pomodoro-records-comp
                    style="grid-area: today"
                    :records="todayRecords"
                    :loading="recordLoading"
                    :disabled-next-page="recordIsDone"
                    @next-page="handleNextPage"
                />
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
#PomodoroFocus {
    padding: var(--nue-padding-df);
    gap: var(--nue-gap-df);

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

                > .nue-div--title {
                    align-items: center;
                    font-size: var(--nue-text-xl);
                    gap: var(--nue-gap-2xs);
                }

                > .nue-div--actions {
                    width: fit-content;
                    margin-left: auto;
                }
            }

            > .nue-text--description {
                font-size: var(--nue-text-sm);
                color: var(--nue-primary-color-600);
            }
        }

        > .nue-div--actions {
            gap: var(--nue-gap-sm);
        }
    }

    > .nue-main .nue-content {
        display: grid;
        grid-template-columns: minmax(24rem, 3fr) 4fr;
        grid-template-rows: minmax(24rem, 3fr) 4fr;
        grid-template-areas: 'timer today' 'note note';
        width: 100%;
        height: 100%;
        flex: none;
        gap: var(--nue-gap-df);
        overflow: visible;

        @media (max-width: 480px) {
            grid-template-columns: 1fr;
            grid-template-rows: minmax(24rem, 3fr) 4fr;
            grid-template-areas: 'timer' 'note' 'today';
            gap: var(--nue-gap-lg);
        }
    }
}
</style>

