import { defineStore } from 'pinia'
import { usePomodoroRecordStoreBase } from '../hooks'

export const usePomodoroRecordsStore = defineStore('PomodoroRecordsStore', () => {
    const {
        recordsMapper: records,
        addRecord,
        addRecords,
        getRecord,
        onRecordCreated
    } = usePomodoroRecordStoreBase()

    return {
        records,
        addRecord,
        addRecords,
        getRecord,
        onRecordCreated
    }
})