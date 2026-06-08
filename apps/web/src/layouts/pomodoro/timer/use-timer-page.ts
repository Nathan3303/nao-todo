import { computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import { NueMessage, NueConfirm } from 'nue-ui'
import usePomodoroStore from '@/stores/pomodoro-store'
import { usePomodoroTimerStore } from '@/stores/pomodoro-timer-store'
import { POMODORO_TIMER_SETTING_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'
import type DialogManager from '@/infrastructure/hooks/use-dialog-manager'
import type { TaskViewObject } from '@nao-todo/types'
import { PomodoroRecordUseCase } from '@nao-todo/application/web/usecases/pomodoro'
import usePomodoroRecordLoader from './use-pomodoro-record-loader'
import { MIN_FOCUS_SECONDS, MAX_FOCUS_SECONDS } from './constants'

/**
 * 番茄钟计时器页面 composable
 * @description 封装计时器的 UI 交互逻辑（NueConfirm / NueMessage / 对话框管理），
 *              计时器引擎状态由 usePomodoroTimerStore 全局管理。
 */
export const useTimerPage = (dialogManager: DialogManager) => {
    const pomodoroStore = usePomodoroStore()
    const timerStore = usePomodoroTimerStore()

    // @usecase Pomodoro 记录用例（用于加载记录列表）
    const pomodoroRecordUseCase = PomodoroRecordUseCase.create({
        addRecord: (record) => {
            pomodoroStore.addRecord(record)
        },
        addRecords: (records) => {
            pomodoroStore.addRecords(records)
        }
    })

    // @loader Pomodoro 记录加载器
    const recordLoader = usePomodoroRecordLoader(pomodoroRecordUseCase, {
        startTime: dayjs().startOf('day').toISOString(),
        endTime: dayjs().endOf('day').toISOString(),
        type: 0,
        sort: 'startAt:desc'
    })

    // @computed 当前选中任务名称
    const taskName = computed(() => pomodoroStore.currentTaskName)

    /**
     * 处理任务选择
     */
    const handleSelectTask = (task: TaskViewObject) => {
        pomodoroStore.selectTask(task.id, task.name)
    }

    /**
     * 处理开始专注
     * @description 验证时间范围、请求通知权限、无任务时弹出确认框
     */
    const handleStart = () => {
        const seconds = timerStore.totalSeconds
        if (seconds < MIN_FOCUS_SECONDS) {
            NueMessage.warn('专注时间不能小于 5 分钟')
            return
        }
        if (seconds > MAX_FOCUS_SECONDS) {
            NueMessage.warn('专注时间不能大于 180 分钟')
            return
        }

        const doStart = () => {
            // 预请求系统通知权限
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission()
            }
            timerStore.start()
        }

        if (!pomodoroStore.currentTaskId) {
            NueConfirm({
                title: '确认开始专注',
                content: '还没有选择待办任务，是否要继续开始专注？',
                confirmButtonText: '继续',
                cancelButtonText: '取消',
                onConfirm: doStart
            })
        } else {
            doStart()
        }
    }

    /**
     * 调整专注时间
     * @param delta 调整时间（秒）
     */
    const handleAdjustTime = (delta: number) => {
        timerStore.adjustTime(delta)
    }

    /**
     * 重置专注
     */
    const handleReset = () => {
        timerStore.reset()
    }

    /**
     * 打开专注钟设置弹窗
     */
    const handleOpenSettings = () => {
        dialogManager.open(POMODORO_TIMER_SETTING_DIALOG_KEY, null, () => {
            timerStore.updateConfig()
        })
    }

    /**
     * 保存专注记录笔记
     */
    const handleSaveNote = () => {
        if (pomodoroStore.currentRecordId) {
            pomodoroStore.updateNote(pomodoroStore.currentRecordId, pomodoroStore.noteText)
        }
    }

    /**
     * 加载更多记录（NueInfiniteScroll 回调）
     */
    const handleNextPage = () => {
        recordLoader.loadNextPage()
    }

    // @computed 今日专注记录（由 loader 管理，数据从 Store 映射）
    const todayRecords = recordLoader.records

    // @onMounted 加载今日专注记录
    onMounted(() => {
        recordLoader.loadFirstPage()
    })

    // @returns
    return {
        taskName,
        handleSelectTask,
        todayRecords,
        /** 当前笔记文本（绑定到 pomodoro-notes-comp） */
        noteText: computed(() => pomodoroStore.noteText),
        /** 更新笔记文本 */
        setNoteText: (text: string) => pomodoroStore.setNoteText(text),
        handleStart,
        handleAdjustTime,
        handleReset,
        handleOpenSettings,
        handleSaveNote,
        /** 记录加载状态 */
        recordLoading: computed(() => recordLoader.states.loading),
        /** 是否已加载全部记录 */
        recordIsDone: computed(() => recordLoader.states.isDone),
        /** 加载更多记录 */
        handleNextPage
    }
}

