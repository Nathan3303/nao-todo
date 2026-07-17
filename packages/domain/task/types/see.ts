/** SSE 提醒推送事件 */
export type SSEReminderEvent = {
    type: 'REMINDER'
    taskId: string
    taskName: string
    description: string
    remindAt: string
}

/** POST /api/tasks/:taskId/snooze 请求体 */
export type SnoozeTaskRequest = {
    durationMinutes: number
}

/** POST /api/tasks/:taskId/snooze 响应体 */
export type SnoozeTaskResponse = {
    remindAt: string
}

