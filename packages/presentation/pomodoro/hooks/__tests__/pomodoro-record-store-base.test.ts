// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import type { PomodoroRecordViewObject } from '@nao-todo/domain-pomodoro'
import { usePomodoroRecordStoreBase } from '../use-pomodoro-record-store-base'

/**
 * T455 C1：`addRecords`（读路径）不得触发「记录创建」通知
 * @description `PomodoroRecordUseCase.getRecords` 会把查询结果写入 store（`addRecords`）；
 *              「新建」信号必须仅由 `addRecord`（`createRecord` 写入路径）触发，
 *              否则别页查询会被误报为新建 ⇒ 侧栏「今日专注」被污染。
 *
 *              T473：单回调 setter → **多订阅者**（注册返回幂等注销句柄），
 *              本文件同时锁死「两订阅者都收到 / 注销只移除自己 / 派发中注销不跳过他人」。
 */

const rec = (id: string): PomodoroRecordViewObject =>
    ({ id }) as unknown as PomodoroRecordViewObject

describe('T455 读/写路径的「新建」信号分离', () => {
    it('addRecords（列表查询写入）⇒ 不触发通知，但记录已入 store', () => {
        const store = usePomodoroRecordStoreBase()
        const onCreated = vi.fn()
        store.onRecordCreated(onCreated)

        store.addRecords([rec('q1'), rec('q2')])

        expect(onCreated).not.toHaveBeenCalled()
        expect(store.getRecord('q1')).toBeTruthy()
        expect(store.getRecord('q2')).toBeTruthy()
    })

    it('addRecord（真实创建写入）⇒ 通知（仅新记录）', () => {
        const store = usePomodoroRecordStoreBase()
        const onCreated = vi.fn()
        store.onRecordCreated(onCreated)

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
        store.onRecordCreated(onCreated)

        store.addRecords([rec('x1')])
        store.addRecord(rec('x1'))
        expect(onCreated).not.toHaveBeenCalled()
    })
})

describe('T473 多订阅者（取代单回调 setter）', () => {
    it('两个订阅者都收到（旧实现只有最后一个收到）', () => {
        const store = usePomodoroRecordStoreBase()
        const a = vi.fn()
        const b = vi.fn()
        store.onRecordCreated(a)
        store.onRecordCreated(b)

        store.addRecord(rec('n1'))

        expect(a).toHaveBeenCalledTimes(1)
        expect(b).toHaveBeenCalledTimes(1)
        expect(a).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }))
        expect(b).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }))
    })

    it('注销后不再收到，且不影响其它订阅者（旧实现置 null 会清空全部）', () => {
        const store = usePomodoroRecordStoreBase()
        const a = vi.fn()
        const b = vi.fn()
        const offA = store.onRecordCreated(a)
        store.onRecordCreated(b)

        offA()
        offA() // 幂等：重复调用安全（不抛错、不误删他人）

        store.addRecord(rec('n1'))
        expect(a).not.toHaveBeenCalled()
        expect(b).toHaveBeenCalledTimes(1)
    })

    it('只移除自己：后注册者注销不影响先注册者', () => {
        const store = usePomodoroRecordStoreBase()
        const a = vi.fn()
        const b = vi.fn()
        store.onRecordCreated(a)
        const offB = store.onRecordCreated(b)

        offB()
        store.addRecord(rec('n1'))
        expect(a).toHaveBeenCalledTimes(1)
        expect(b).not.toHaveBeenCalled()
    })

    it('派发中注销不会跳过其它订阅者（对快照迭代）', () => {
        const store = usePomodoroRecordStoreBase()
        const b = vi.fn()
        let offA: () => void = () => {}
        offA = store.onRecordCreated(() => offA())
        store.onRecordCreated(b)

        store.addRecord(rec('n1'))
        expect(b).toHaveBeenCalledTimes(1)
    })
})