import type { PomodoroRecordViewObject } from '@nao-todo/domain-pomodoro'
import { useMapperStoreBase } from '@nao-todo/shared/hooks'

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

    /**
     * 批量写入记录
     * @description T455 修复：**列表查询（读路径）不得触发 `onRecordCreated`**。
     *              `PomodoroRecordUseCase.getRecords` 会把查询结果写入 store（`addRecords`），
     *              若此处触发「新建」回调，会把**别页查询到的记录**误报为新建
     *              ⇒ 侧栏「今日专注」loader 的 `prependRecordId` 被污染。
     *              「新建」信号现仅在 `addRecord`（`createRecord` 写入路径）触发。
     */
    const addRecords = (newRecords: PomodoroRecordViewObject[]) => {
        newRecords.forEach((record) => {
            originalAddRecord(record)
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