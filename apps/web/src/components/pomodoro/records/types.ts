import type {
    PomodoroRecordViewObject,
    PomodoroType,
    PomodoroViewObject
} from '@nao-todo/domain-pomodoro'
import { GetTasksOptions } from '@nao-todo/shared'

export type PomodoroRecordsColumnKey =
    | 'type'
    | 'taskName'
    | 'pomodoroName'
    | 'duration'
    | 'startAt'
    | 'endAt'
    | 'note'

export type PomodoroRecordsColumnConfig = {
    key: PomodoroRecordsColumnKey
    label: string
    visible: boolean
    width: number | null
    minWidth: number
    maxWidth: number
    defaultWidth: number
    sortable: boolean
}

export type PomodoroRecordsFilterState = {
    startTime: string
    endTime: string
    type?: PomodoroType
    taskName: string
    pomodoroId: string
}

export type PomodoroRecordsTableContext = {
    records: { value: PomodoroRecordViewObject[] }
    filters: PomodoroRecordsFilterState
    pagination: { total: number; page: number; limit: number; maxPage: number }
    getOptions: { value: GetTasksOptions }
    loading: { value: boolean }
    isDone: { value: boolean }
    pomodoros: { value: PomodoroViewObject[] }
    selectedRecord: { value: PomodoroRecordViewObject | null }
    detailVisible: { value: boolean }
    changeSort: (field: string, order: 'asc' | 'desc') => Promise<void>
    goToPage: (page: number) => Promise<void>
    setPageSize: (limit: number) => Promise<void>
    applyFilters: (filters: Partial<PomodoroRecordsFilterState>) => void
    resetFilters: () => void
    showDetail: (recordId: string) => void
    hideDetail: () => void
    getPomodoroName: (pomodoroId: string | null) => string
}