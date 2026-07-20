import { defineStore } from 'pinia'
import { usePomodoroRecordStoreBase } from '../hooks'

export const usePomodoroRecordsStore = defineStore('PomodoroRecordsStore', () => {
    const {
        recordsMapper: records,
        addRecord,
        addRecords,
        getRecord,
        setOnRecordCreated
    } = usePomodoroRecordStoreBase()

    return {
        records,
        addRecord,
        addRecords,
        getRecord,
        setOnRecordCreated
    }
})
