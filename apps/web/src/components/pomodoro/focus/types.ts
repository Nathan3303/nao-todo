/**
 * 正计时状态
 */
export type FocusStatus = 'idle' | 'running' | 'paused'

/**
 * 正计时组件属性
 */
export interface FocusProps {
    /** 正计时状态 */
    status: FocusStatus
    /** 累计秒数 */
    elapsedSeconds: number
    /** 关联任务名称 */
    taskName?: string
}

/**
 * 正计时组件事件
 */
export interface FocusEmits {
    /** 开始正计时 */
    (e: 'start'): void
    /** 暂停正计时 */
    (e: 'pause'): void
    /** 恢复正计时 */
    (e: 'resume'): void
    /** 结束正计时（创建记录） */
    (e: 'end'): void
    /** 取消正计时（不创建记录） */
    (e: 'cancel'): void
}
