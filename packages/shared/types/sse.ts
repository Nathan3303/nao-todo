/**
 * SSE 任务提醒事件
 * @description 服务端 `reminder` 事件推送的载荷
 */
export type SSEReminderEvent = {
    taskId: string
    taskName: string
    description?: string
}