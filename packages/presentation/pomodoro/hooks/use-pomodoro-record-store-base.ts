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

    /**
     * 「记录创建」订阅者集合（**多订阅者**；`T473` 取代原**单回调 setter**）
     * @description 原实现为单回调槽（`cb | null`），有两个缺陷：
     *              ① 第二个注册者**覆盖**第一个；
     *              ② 任一消费方卸载时置 `null` 会**清空他人回调**（Pinia 单例下真实可达）。
     */
    const recordCreatedSubscribers = new Set<(record: PomodoroRecordViewObject) => void>()

    /**
     * 注册「记录创建」订阅
     * @description 注册为**追加**（非覆盖），返回**幂等**注销句柄（仅移除本次注册；重复调用安全）。
     * @param cb 订阅回调
     * @returns 注销句柄
     */
    const onRecordCreated = (cb: (record: PomodoroRecordViewObject) => void): (() => void) => {
        recordCreatedSubscribers.add(cb)
        return () => {
            recordCreatedSubscribers.delete(cb)
        }
    }

    const addRecord = (record: PomodoroRecordViewObject) => {
        const exists = getRecord(record.id)
        originalAddRecord(record)
        if (!exists) {
            // 对**快照**迭代：派发过程中注销不会跳过其它订阅者
            const subscribersSnapshot = Array.from(recordCreatedSubscribers)
            for (const cb of subscribersSnapshot) cb(record)
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
        onRecordCreated
    }
}

export type PomodoroRecordStoreBase = ReturnType<typeof usePomodoroRecordStoreBase>