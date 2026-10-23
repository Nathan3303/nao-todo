/**
 * 任务提醒事件
 * @description 原 SSE 事件类型迁移而来（T527 / AC10，原文件 `types/sse.ts` 已下线）：
 *              提醒判定已从服务端 SSE 下移到本机轮询，载荷语义不变（任务标识 + 展示文案），
 *              应用内弹窗与系统通知共用同一形状。
 */
export type TaskReminderEvent = {
    taskId: string
    taskName: string
    description?: string
}