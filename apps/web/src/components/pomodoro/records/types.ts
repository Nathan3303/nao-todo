import type { PomodoroRecordViewObject } from '@nao-todo/types'

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
}

/**
 * 专注记录组件 emits
 * @param nextPage 加载下一页专注记录
 */
export type PomodoroRecordsCompEmits = {
    (e: 'nextPage'): void
}
