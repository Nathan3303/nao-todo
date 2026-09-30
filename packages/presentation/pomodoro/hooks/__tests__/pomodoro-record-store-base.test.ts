// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import type { PomodoroRecordViewObject } from '@nao-todo/domain-pomodoro'
import { usePomodoroRecordStoreBase } from '../use-pomodoro-record-store-base'

/**
 * T455 C1：`addRecords`（读路径）不得触发 `onRecordCreated`
 * @description `PomodoroRecordUseCase.getRecords` 会把查询结果写入 store（`addRecords`）；
 *              「新建」信号必须仅由 `addRecord`（`createRecord` 写入路径）触发，
 *              否则别页查询会被误报为新建 ⇒ 侧栏「今日专注」被污染。
 */

const rec = (id: string): PomodoroRecordViewObject =>
    ({ id }) as unknown as PomodoroRecordViewObject

describe('T455 usePomodoroRecordStoreBase：读/写路径的「新建」信号分离', () => {
    it('addRecords（列表查询写入）⇒ 不触发 onRecordCreated，但记录已入 store', () => {
        const store = usePomodoroRecordStoreBase()
        const onCreated = vi.fn()
        store.setOnRecordCreated(onCreated)

        store.addRecords([rec('q1'), rec('q2')])

        expect(onCreated).not.toHaveBeenCalled()
        expect(store.getRecord('q1')).toBeTruthy()
        expect(store.getRecord('q2')).toBeTruthy()
    })

    it('addRecord（真实创建写入）⇒ 触发 onRecordCreated（仅新记录）', () => {
        const store = usePomodoroRecordStoreBase()
        const onCreated = vi.fn()
        store.setOnRecordCreated(onCreated)

        store.addRecord(rec('n1'))
        expect(onCreated).toHaveBeenCalledTimes(1)
        expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }))

        // 已存在的记录不重复触发
        store.addRecord(rec('n1'))
        expect(onCreated).toHaveBeenCalledTimes(1)
    })

    it('addRecords 后再 addRecord 同 id ⇒ 不因已存在而补触发（语义不回归）', () => {
        const store = usePomodoroRecordStoreBase()
        const onCreated = vi.fn()
        store.setOnRecordCreated(onCreated)

        store.addRecords([rec('x1')])
        store.addRecord(rec('x1'))
        expect(onCreated).not.toHaveBeenCalled()
    })
})