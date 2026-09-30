// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { createPinia, setActivePinia } from 'pinia'
import type { Subscriber } from '@nao-todo/shared/hooks'
import type { PomodoroRecordViewObject } from '@nao-todo/domain-pomodoro'
import { usePomodoroRecordsStore } from '../../stores'
import { usePomodoroRecordLoader } from '../use-pomodoro-record-loader'

/**
 * T455 C1 回归：记录页/常用专注页的「查询」不得污染侧栏「今日专注」
 * @description 复现原缺陷链路：两个独立 loader 共享 Pinia store；
 *              记录页 loader 的 `loadFirstPage` 经 usecase 写入 store，
 *              旧实现会触发全局 `onRecordCreated` ⇒ 侧栏 loader `prependRecordId` 被污染。
 *              C1 后：读路径不触发；真实创建（`store.addRecord`）仍即时置顶。
 */

const rec = (id: string): PomodoroRecordViewObject =>
    ({ id }) as unknown as PomodoroRecordViewObject

const ids = (loader: ReturnType<typeof usePomodoroRecordLoader>): string[] =>
    loader.records.value.map((r) => r.id)

/** 极简订阅总线（实现 loader 依赖的 subscribe/unsubscribe/emit） */
const makeSubscriber = (): Subscriber => {
    const handlers = new Map<string, Set<(payload: unknown) => void>>()
    return {
        subscribe: (event: string, handler: (payload: unknown) => void) => {
            if (!handlers.has(event)) handlers.set(event, new Set())
            handlers.get(event)!.add(handler)
        },
        unsubscribe: (event: string, handler: (payload: unknown) => void) => {
            handlers.get(event)?.delete(handler)
        },
        emit: (event: string, payload?: unknown) => {
            handlers.get(event)?.forEach((h) => h(payload))
        }
    } as unknown as Subscriber
}

/** 模拟 PomodoroRecordUseCase：查询 → 写入共享 store → 返回 ids */
const makeUsecase = (records: PomodoroRecordViewObject[]) =>
    ({
        getRecords: async () => {
            usePomodoroRecordsStore().addRecords(records)
            return [
                {
                    recordIds: records.map((r) => r.id),
                    pagination: { total: records.length, page: 1, limit: 20, maxPage: 1 }
                },
                null
            ]
        }
    }) as never

describe('T455 侧栏「今日专注」不被其它页查询污染（C1）', () => {
    it('记录页查询后：侧栏仍只含今日记录；记录页自身不受影响', async () => {
        setActivePinia(createPinia())
        const subscriber = makeSubscriber()

        const sidebar = usePomodoroRecordLoader(
            makeUsecase([rec('t1'), rec('t2')]),
            { sort: 'startAt:desc' } as never,
            subscriber
        )
        await sidebar.loadFirstPage()
        expect(ids(sidebar).sort()).toEqual(['t1', 't2'])

        // 记录页 loader（无 subscriber）查询「其它」记录
        const recordsPage = usePomodoroRecordLoader(makeUsecase([rec('r1'), rec('r2')]), {
            sort: 'startAt:desc'
        } as never)
        await recordsPage.loadFirstPage()

        // 侧栏不被污染（旧实现此处会混入 r1/r2）
        expect(ids(sidebar).sort()).toEqual(['t1', 't2'])
        // 记录页自身仍正确
        expect(ids(recordsPage).sort()).toEqual(['r1', 'r2'])
    })

    it('真实创建记录 ⇒ 侧栏即时置顶（写入路径仍触发）', async () => {
        setActivePinia(createPinia())
        const subscriber = makeSubscriber()

        const sidebar = usePomodoroRecordLoader(
            makeUsecase([rec('t1')]),
            { sort: 'startAt:desc' } as never,
            subscriber
        )
        await sidebar.loadFirstPage()
        expect(ids(sidebar)).toEqual(['t1'])

        usePomodoroRecordsStore().addRecord(rec('new1'))
        expect(ids(sidebar)[0]).toBe('new1')
        expect(ids(sidebar).sort()).toEqual(['new1', 't1'])
    })
})