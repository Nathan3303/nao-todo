/**
 * 任务提醒事件
 * @description 原 SSE 事件类型迁移而来（T527 / AC10，原文件 `types/sse.ts` 已下线）：
 *              提醒判定已从服务端 SSE 下移到本机轮询；应用内弹窗与系统通知共用同一形状。
 *              T531 扩 `projectId` / `remindAt`：清单名由装配层按 `projectId` 注入解析，
 *              `remindAt` = **本次触发时刻**（引擎在 consume 前组装，天然是原值）。
 */
export type TaskReminderEvent = {
    taskId: string
    taskName: string
    description?: string
    /** 清单标识（弹窗层不引路由/仓储，清单名经装配层注入） */
    projectId: string
    /** 本次原定提醒时刻（ISO 串；补弹时用于标注「原定 …」） */
    remindAt: string
}