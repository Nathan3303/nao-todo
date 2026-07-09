import type { PomodoroRecordViewObject } from './viewobjects'

/**
 * Pomodoro 记录存储接口
 * @description PomodoroUseCase 依赖的存储抽象
 */
export interface PomodoroRecordStore {
    /**
     * 添加 Pomodoro 记录
     * @param record Pomodoro 记录视图对象
     */
    addRecord(record: PomodoroRecordViewObject): void

    /**
     * 添加 Pomodoro 记录列表
     * @param records Pomodoro 记录视图对象列表
     */
    addRecords(records: PomodoroRecordViewObject[]): void
}

