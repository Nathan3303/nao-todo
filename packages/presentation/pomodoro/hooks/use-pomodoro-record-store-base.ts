import type { PomodoroRecordViewObject } from '@nao-todo/application/pomodoro/viewobjects'
import { useMapperStoreBase } from '@nao-todo/shared'

export const usePomodoroRecordStoreBase = () => {
    const {
        list: records,
        map: recordsMapper,
        setList: setRecords,
        addItem: originalAddRecord,
        getItem: getRecord
    } = useMapperStoreBase<PomodoroRecordViewObject>()

    let onRecordCreated: ((record: PomodoroRecordViewObject) => void) | null = null

    const setOnRecordCreated = (cb: ((record: PomodoroRecordViewObject) => void) | null) => {
        onRecordCreated = cb
    }

    const addRecord = (record: PomodoroRecordViewObject) => {
        const exists = getRecord(record.id)
        originalAddRecord(record)
        if (!exists) {
            onRecordCreated?.(record)
        }
    }

    const addRecords = (newRecords: PomodoroRecordViewObject[]) => {
        newRecords.forEach((record) => {
            addRecord(record)
        })
    }

    return {
        records,
        recordsMapper,
        setRecords,
        addRecord,
        getRecord,
        addRecords,
        setOnRecordCreated
    }
}

export type PomodoroRecordStoreBase = ReturnType<typeof usePomodoroRecordStoreBase>

