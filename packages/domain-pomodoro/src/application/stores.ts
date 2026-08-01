import type {
    UpdatePomodoroViewObject,
    PomodoroViewObject,
    PomodoroRecordViewObject
} from './viewobjects/pomodoro'

// Pomodoro 存储接口
export type PomodoroStore = {
    pomodoros: PomodoroViewObject[]
    setPomodoros: (pomodoros: PomodoroViewObject[]) => void
    addPomodoro: (pomodoro: PomodoroViewObject) => void
    getPomodoro: (id: string) => PomodoroViewObject | undefined
    patchPomodoro: (id: string, update: Partial<UpdatePomodoroViewObject>) => void
    getAllPomodoros: () => PomodoroViewObject[]
}

// Pomodoro 记录存储接口
export type PomodoroRecordStore = {
    records: Map<string, PomodoroRecordViewObject>
    addRecord: (record: PomodoroRecordViewObject) => void
    addRecords: (records: PomodoroRecordViewObject[]) => void
    getRecord: (id: string) => PomodoroRecordViewObject | undefined
}