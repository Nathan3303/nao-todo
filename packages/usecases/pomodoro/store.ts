import type { PomodoroRecordViewObject, PomodoroViewObject } from './viewobjects'

/**
 * 常用番茄专注存储接口
 * @description PomodoroUseCase 依赖的存储抽象
 */
export interface PomodoroStore {
    /**
     * 设置常用番茄专注列表
     * @param pomodoros 常用番茄专注视图对象列表
     */
    setPomodoros(pomodoros: PomodoroViewObject[]): void

    /**
     * 添加常用番茄专注
     * @param pomodoro 常用番茄专注视图对象
     */
    addPomodoro(pomodoro: PomodoroViewObject): void
}

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

