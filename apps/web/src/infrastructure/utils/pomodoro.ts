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
