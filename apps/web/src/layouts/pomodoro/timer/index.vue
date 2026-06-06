<script setup lang="ts">
import { inject } from 'vue'
import { PomodoroTimerComp, PomodoroRecordsComp, PomodoroNotesComp } from '@/components/pomodoro'
import type { PomodoroViewContext } from '@/views/index/pomodoro/pomodoro-view'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { useTimerPage } from './use-timer-page'
import { PomodoroTaskSelectDropdown } from '../task-select-dropdown'

defineOptions({ name: 'PomodoroTimer' })

const { isDisplayAside, switchDisplayAside, dialogManager } =
    inject<PomodoroViewContext>(POMODORO_VIEW_CONTEXT_KEY)!

const {
    timer,
    taskName,
    handleSelectTask,
    todayRecords,
    noteText,
    setNoteText,
    handleStart,
    handleAdjustTime,
    handleReset,
    handleOpenSettings,
    handleSaveNote
} = useTimerPage(dialogManager)
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
                    :phase="timer.phase.value"
                    :is-running="timer.isRunning.value"
                    :remaining-seconds="timer.remainingSeconds.value"
                    :total-seconds="timer.totalSeconds.value"
                    :task-name="taskName"
                    @start="handleStart"
                    @pause="timer.pause()"
                    @resume="timer.resume()"
                    @reset="handleReset"
                    @skip="timer.skip()"
                    @adjust-time="handleAdjustTime($event)"
                >
                    <template #BelowTimeString>
                        <pomodoro-task-select-dropdown @select-task="handleSelectTask">
                            <template #default="{ open }">
                                <nue-link @click="open">
                                    {{ taskName || '未选择专注任务' }}
                                </nue-link>
                            </template>
                        </pomodoro-task-select-dropdown>
                    </template>
                </pomodoro-timer-comp>
                <pomodoro-records-comp style="grid-area: today" :records="todayRecords" />
                <pomodoro-notes-comp
                    style="grid-area: note"
                    :note-text="noteText"
                    @update:note-text="setNoteText($event)"
                    @save="handleSaveNote"
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
        height: 100%;
        overflow: hidden;
        gap: 2rem;

        @media (max-width: 480px) {
            grid-template-columns: 1fr;
            grid-template-rows: minmax(24rem, 3fr) 4fr;
            grid-template-areas: 'timer' 'note' 'today';
            gap: var(--nue-gap-df);
        }
    }
}
</style>

