import type { PomodoroRecordViewObject } from '@nao-todo/domain-pomodoro'

/**
 * 专注记录组件 props
 * @param records 专注记录列表
 * @param loading 是否正在加载
 * @param disabledNextPage 是否禁用下一页加载
 */
export type PomodoroRecordsCompProps = {
    records: PomodoroRecordViewObject[]
    loading: boolean
    disabledNextPage: boolean
    /**
     * 隐藏内置标题（默认 false）
     * @description T451：移入侧栏 NueCollapse 时由 collapse 标题承载，避免标题重复；默认路径不变。
     */
    hideHeader?: boolean
    /**
     * 紧凑条目（默认 false）
     * @description T456 ②：侧栏窄宽度下条目两行 + 字号 xs；默认路径不变。
     */
    compact?: boolean
}

/**
 * 专注记录组件 emits
 * @param nextPage 加载下一页专注记录
 */
export type PomodoroRecordsCompEmits = {
    (e: 'nextPage'): void
}