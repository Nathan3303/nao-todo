<script setup lang="ts">
import { inject, computed } from 'vue'
import { nanoid } from 'nanoid'
import dayjs from 'dayjs'
import { NueMessage } from 'nue-ui'
import { PomodoroTimerComp, PomodoroRecordsComp, PomodoroNotesComp } from '@/components/pomodoro'
import type { PomodoroRecordViewObject } from '@/components/pomodoro/timer/types'
import type { PomodoroViewContext } from '@/views/index/pomodoro/pomodoro-view'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { useTimer } from '@/components/pomodoro/timer/use-timer'
import usePomodoroStore from '@/stores/pomodoro-store'
import useTasksStore from '@/stores/tasks-store'
import { POMODORO_TIMER_SETTING_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'

defineOptions({ name: 'PomodoroTimer' })

// @constants 时间边界
const MIN_FOCUS_SECONDS = 5 * 60 // 5 分钟
const MAX_FOCUS_SECONDS = 180 * 60 // 3 小时

// @utils 格式化分钟数
const formatMinutes = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    if (mins < 60) return `${mins} 分钟`
    const hours = Math.floor(mins / 60)
    const remain = mins % 60
    return remain > 0 ? `${hours} 小时 ${remain} 分钟` : `${hours} 小时`
}

// @utils 发送系统通知
const notify = (title: string, body: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    new Notification(title, { body })
}

// @props 路由参数
const props = defineProps<{ taskId?: string }>()

// @context 番茄钟视图上下文
const { isDisplayAside, switchDisplayAside, dialogManager } =
    inject<PomodoroViewContext>(POMODORO_VIEW_CONTEXT_KEY)!

// @store
const pomodoroStore = usePomodoroStore()
const tasksStore = useTasksStore()

// @computed 根据 taskId 获取任务名称
const taskName = computed(() => {
    if (!props.taskId) return ''
    return tasksStore.getTask(props.taskId)?.name ?? ''
})

// 开始新的专注会话（生成 record ID 和开始时间）
const startNewFocusSession = () => {
    const recordId = nanoid()
    const startAt = new Date().toISOString()
    pomodoroStore.setCurrentSession(
        pomodoroStore.currentTaskId,
        pomodoroStore.currentTaskName,
        recordId,
        startAt
    )
    pomodoroStore.setNoteText('')
}

// @composable 纯倒计时逻辑
const timer = useTimer({
    focusDuration: pomodoroStore.focusDuration,
    breakDuration: pomodoroStore.breakDuration,
    longBreakDuration: pomodoroStore.longBreakDuration,
    sessionsUntilLongBreak: pomodoroStore.sessionsUntilLongBreak,
    onPhaseComplete(phase, _elapsed, total) {
        if (phase === 'focus') {
            // 创建专注记录
            const record: PomodoroRecordViewObject = {
                id: pomodoroStore.currentRecordId!,
                taskId: pomodoroStore.currentTaskId ?? '',
                name: pomodoroStore.currentTaskName || '未关联任务',
                type: 'timer',
                startAt: pomodoroStore.currentRecordStartAt!,
                endAt: new Date().toISOString(),
                duration: total,
                note: pomodoroStore.noteText
            }
            // TODO: 后端接口就绪后替换为真实 API 请求
            console.log('[Pomodoro] 创建专注记录', record)
            pomodoroStore.addRecord(record)
            notify('专注完成', `已完成 ${formatMinutes(total)} 的专注，现在开始休息`)
        }
        // 休息阶段结束 → 自动开启下一次专注
        if (phase === 'break' || phase === 'longBreak') {
            startNewFocusSession()
            notify('休息结束', '现在开始下一轮的专注计时')
        }
    },
    onBreakWarning(remaining: number) {
        const mins = Math.floor(remaining / 60)
        const secs = remaining % 60
        const timeStr = mins > 0 ? `${mins} 分钟${secs > 0 ? ` ${secs} 秒` : ''}` : `${secs} 秒`
        notify('休息即将结束', `剩余 ${timeStr} 的休息时间，准备好进行下一轮专注了吗？`)
    },
    onSkip(phase, elapsed, total) {
        if (phase === 'focus') {
            // 跳过专注：创建部分记录
            const record: PomodoroRecordViewObject = {
                id: pomodoroStore.currentRecordId!,
                taskId: pomodoroStore.currentTaskId ?? '',
                name: pomodoroStore.currentTaskName || '未关联任务',
                type: 'timer',
                startAt: pomodoroStore.currentRecordStartAt!,
                endAt: new Date().toISOString(),
                duration: total,
                note: pomodoroStore.noteText
            }
            console.log('[Pomodoro] 跳过专注，创建部分记录', record)
            pomodoroStore.addRecord(record)
            // 准备下一次专注
            startNewFocusSession()
        }
        if (phase === 'break') {
            // 跳过休息：直接开始下一次专注
            startNewFocusSession()
        }
    }
})

// @handlers
const handleStart = () => {
    const seconds = timer.totalSeconds.value
    if (seconds < MIN_FOCUS_SECONDS) {
        NueMessage.warn('专注时间不能小于 5 分钟')
        return
    }
    if (seconds > MAX_FOCUS_SECONDS) {
        NueMessage.warn('专注时间不能大于 180 分钟')
        return
    }
    // 预请求系统通知权限
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
    }
    const recordId = nanoid()
    const startAt = new Date().toISOString()
    pomodoroStore.setCurrentSession(props.taskId ?? null, taskName.value, recordId, startAt)
    pomodoroStore.setNoteText('')
    timer.start()
}

const handleAdjustTime = (delta: number) => {
    timer.adjustTime(delta)
    // 空闲状态下的调整需要同步回 store，作为后续专注会话的默认时长
    if (timer.phase.value === 'idle') {
        pomodoroStore.setFocusDuration(timer.totalSeconds.value)
    }
}

const handleReset = () => {
    timer.reset()
    pomodoroStore.clearCurrentSession()
}

const handleOpenSettings = () => {
    dialogManager.open(POMODORO_TIMER_SETTING_DIALOG_KEY, null, () => {
        timer.updateConfig({
            focusDuration: pomodoroStore.focusDuration,
            breakDuration: pomodoroStore.breakDuration,
            longBreakDuration: pomodoroStore.longBreakDuration,
            sessionsUntilLongBreak: pomodoroStore.sessionsUntilLongBreak
        })
    })
}

const handleSaveNote = () => {
    if (pomodoroStore.currentRecordId) {
        pomodoroStore.updateNote(pomodoroStore.currentRecordId, pomodoroStore.noteText)
        console.log('[Pomodoro] 保存笔记', {
            recordId: pomodoroStore.currentRecordId,
            note: pomodoroStore.noteText
        })
    }
}

// @computed 今日专注记录
const todayRecords = computed(() =>
    pomodoroStore.records.filter((r) => dayjs(r.startAt).isSame(dayjs(), 'day'))
)
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
                        <nue-button
                            icon="setting"
                            theme="icon,ghost"
                            @click="handleOpenSettings"
                        />
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
                />
                <pomodoro-records-comp style="grid-area: today" :records="todayRecords" />
                <pomodoro-notes-comp
                    style="grid-area: note"
                    :note-text="pomodoroStore.noteText"
                    @update:note-text="pomodoroStore.setNoteText($event)"
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
        grid-template-columns: min(24rem, 1fr) auto;
        grid-template-rows: 24rem auto;
        grid-template-areas: 'timer today' 'note note';
        height: 100%;
        overflow: hidden;
        gap: 2rem;

        @media (max-width: 480px) {
            grid-template-columns: 1fr;
            grid-template-rows: 24rem auto 24rem;
            grid-template-areas: 'timer' 'note' 'today';
            gap: var(--nue-gap-df);
        }
    }
}
</style>

