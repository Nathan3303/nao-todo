import type { GoAsync } from '@nao-todo/types'
import type {
    CreatePomodoroRecordViewObject,
    PomodoroRecordViewObject,
    PomodoroType
} from '@nao-todo/usecases/pomodoro'

/**
 * 格式化秒数为中文分钟/小时描述
 * @param seconds 秒数
 * @returns 格式化后的字符串，如 "25 分钟"、"2 小时 30 分钟"
 */
export const formatMinutes = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    if (mins < 60) return `${mins} 分钟`
    const hours = Math.floor(mins / 60)
    const remain = mins % 60
    return remain > 0 ? `${hours} 小时 ${remain} 分钟` : `${hours} 小时`
}

/**
 * 发送浏览器系统通知
 * @param title 通知标题
 * @param body 通知内容
 */
export const sendNotification = (title: string, body: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    new Notification(title, { body })
}

/**
 * 构建一条专注记录 CreatePomodoroRecordViewObject
 * @description 番茄倒计时（type=1）与正计时（type=2）共用；
 *              统一处理 taskName 兜底、description 为 null、endAt 取当前时刻。
 */
export const buildPomodoroRecord = (params: {
    sessionId: string
    pomodoroId: string | null
    type: PomodoroType
    taskId: string | null
    taskName: string
    startAt: string
    duration: number
    note: string
}): CreatePomodoroRecordViewObject => ({
    sessionId: params.sessionId,
    pomodoroId: params.pomodoroId,
    type: params.type,
    taskId: params.taskId ?? '',
    taskName: params.taskName || '未关联任务',
    description: null,
    startAt: params.startAt,
    endAt: new Date().toISOString(),
    duration: params.duration,
    note: params.note
})

/**
 * 异步持久化一条专注记录
 * @description 封装 addRecord 调用与错误日志，创建失败不阻塞阶段流转。
 * @param addRecord 记录写入方法（来自 usePomodoroRecordsStore）
 * @param record 待写入记录
 * @param errorTag 错误日志前缀
 */
export const persistPomodoroRecord = (
    addRecord: (record: CreatePomodoroRecordViewObject) => GoAsync<PomodoroRecordViewObject[]>,
    record: CreatePomodoroRecordViewObject,
    errorTag: string
) => {
    addRecord(record).then(([, err]) => {
        if (err !== null) console.error(errorTag, err)
    })
}

