import { computed, inject, onMounted, onUnmounted } from 'vue'
import dayjs from 'dayjs'
import { NueConfirm } from 'nue-ui'
import usePomodoroStore from '@/stores/pomodoro-store'
import { usePomodoroFocusStore } from '@/stores/pomodoro-focus-store'
import type DialogManager from '@/infrastructure/hooks/use-dialog-manager'
import type { TaskViewObject, PomodoroRecordViewObject } from '@nao-todo/types'
import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import { PomodoroRecordUseCase } from '@nao-todo/application/web/usecases/pomodoro'
import usePomodoroRecordLoader from '../timer/use-pomodoro-record-loader'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import type { PomodoroViewContext } from '@/views/index/pomodoro/pomodoro-view'

/**
 * 正计时页面 composable
 * @description 封装正计时的 UI 交互逻辑（NueConfirm 无任务确认），
 *              计时器引擎状态由 usePomodoroFocusStore 全局管理。
 */
export const useFocusPage = (dialogManager: DialogManager, subscriber?: Subscriber) => {
    const { showTaskDetails } = inject<PomodoroViewContext>(POMODORO_VIEW_CONTEXT_KEY)!

    const pomodoroStore = usePomodoroStore()
    const focusStore = usePomodoroFocusStore()

    // @usecase Pomodoro 记录用例（用于加载记录列表）
    const pomodoroRecordUseCase = PomodoroRecordUseCase.create({
        addRecord: (record) => {
            pomodoroStore.addRecord(record)
        },
        addRecords: (records) => {
            pomodoroStore.addRecords(records)
        }
    })

    // @loader Pomodoro 记录加载器（仅正计时记录 type=1）
    const recordLoader = usePomodoroRecordLoader(pomodoroRecordUseCase, {
        startTime: dayjs().startOf('day').toISOString(),
        endTime: dayjs().endOf('day').toISOString(),
        type: 1,
        sort: 'startAt:desc'
    })

    // @subscriber 记录创建通知（Subscriber 模式）
    if (subscriber) {
        const handleNewRecordId = (id: string) => {
            recordLoader.prependRecordId(id)
        }
        subscriber.subscribe('AddNewRecordId', handleNewRecordId)
        pomodoroStore.setOnRecordCreated((record: PomodoroRecordViewObject) => {
            subscriber.emit('AddNewRecordId', record.id)
        })
        onUnmounted(() => {
            subscriber.unsubscribe('AddNewRecordId', handleNewRecordId)
            pomodoroStore.setOnRecordCreated(null)
        })
    }

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
     * @description 无任务时弹出确认框
     */
    const handleStart = () => {
        const doStart = () => {
            // 预请求系统通知权限
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission()
            }
            focusStore.start()
        }

        if (!pomodoroStore.currentTaskId) {
            NueConfirm({
                title: '确认开始正计时',
                content: '还没有选择待办任务，是否要继续开始？',
                confirmButtonText: '继续',
                cancelButtonText: '取消',
                onConfirm: doStart
            })
        } else {
            doStart()
        }
    }

    /**
     * 主操作按钮处理：开始 / 暂停 / 继续
     */
    const handleMainAction = () => {
        if (focusStore.status === 'idle') {
            handleStart()
        } else if (focusStore.status === 'running') {
            focusStore.pause()
        } else {
            focusStore.resume()
        }
    }

    /** 取消正计时（不保存记录） */
    const handleCancel = () => {
        focusStore.reset()
    }

    /** 结束正计时（创建记录） */
    const handleEnd = () => {
        focusStore.end()
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
        /** 正计时状态 */
        status: computed(() => focusStore.status),
        /** 累计秒数 */
        elapsedSeconds: computed(() => focusStore.elapsedSeconds),
        /** 当前关联任务 ID */
        taskId: computed(() => pomodoroStore.currentTaskId),
        taskName,
        handleSelectTask,
        todayRecords,
        /** 当前笔记文本（绑定到 pomodoro-notes-comp） */
        noteText: computed(() => pomodoroStore.noteText),
        /** 更新笔记文本 */
        setNoteText: (text: string) => pomodoroStore.setNoteText(text),
        /** 主操作：开始/暂停/继续 */
        handleMainAction,
        /** 取消（不保存记录） */
        handleCancel,
        /** 结束（创建记录） */
        handleEnd,
        /** 记录加载状态 */
        recordLoading: computed(() => recordLoader.states.loading),
        /** 是否已加载全部记录 */
        recordIsDone: computed(() => recordLoader.states.isDone),
        /** 加载更多记录 */
        handleNextPage,
        /** 显示任务详情 */
        showTaskDetails
    }
}
