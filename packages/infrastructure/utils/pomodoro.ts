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
 * @param title 通知标题
 * @param body 通知内容
 */
export const sendNotification = (title: string, body: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    new Notification(title, { body })
}
