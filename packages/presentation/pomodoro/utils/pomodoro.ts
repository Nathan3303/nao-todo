import type { GoAsync } from '@nao-todo/shared'
import type {
    CreatePomodoroRecordViewObject,
    PomodoroRecordViewObject,
    PomodoroType
} from '@nao-todo/domain-pomodoro'

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
 * 格式化 Date 为当日时间 HH:MM:SS
 * @param d 日期对象
 * @returns 格式化后的字符串，如 "09:05:30"
 */
export const formatTimeOfDay = (d: Date): string =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`

/**
 * 格式化秒数为时钟串
 * @param seconds 秒数
 * @returns >=1 小时显示 HH:MM:SS，否则 MM:SS
 */
export const formatClock = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    const mm = String(m).padStart(2, '0')
    const ss = String(s).padStart(2, '0')
    return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * 发送浏览器系统通知
 * @description 复用 @nao-todo/shared 的统一通知封装（权限守卫/默认图标/点击聚焦）
 * @param title 通知标题（动作语义，如"专注完成"）
 * @param body 通知内容
 */
export { sendNotification } from '@nao-todo/shared'

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
    createRecordFn: (record: CreatePomodoroRecordViewObject) => GoAsync<PomodoroRecordViewObject[]>,
    record: CreatePomodoroRecordViewObject,
    errorTag: string
) => {
    createRecordFn(record).then(([, err]) => {
        if (err !== null) console.error(errorTag, err)
    })
}